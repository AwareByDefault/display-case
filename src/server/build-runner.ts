import { cpus } from 'node:os'
import { join, resolve } from 'node:path'

/**
 * The **parent side** of the build-worker mechanism: spawning a fresh,
 * short-lived child for every `Bun.build`, bounding how many run at once, and
 * interpreting a child's exit — including a *native bundler crash* (a signal
 * death) — without ever running `Bun.build` in this process. Shared by the
 * long-lived dev server (`server.ts`) and the one-shot publish command
 * (`publish.ts`) so both inherit the same crash-containment guarantee.
 *
 * The worker itself is `build-case.ts` (the `import.meta.main` CLI). See its
 * module comment for why bundling must never happen in a long-lived process.
 */

const HERE = resolve(import.meta.dir, '..')
const DEFAULT_BUILD_WORKER = join(HERE, 'server', 'build-case.ts')
// Resolved per spawn so a test can inject a stub worker (e.g. one that crashes on
// a signal) via DISPLAY_CASE_BUILD_WORKER to exercise the crash-containment path.
const buildWorkerPath = (): string =>
  process.env.DISPLAY_CASE_BUILD_WORKER ?? DEFAULT_BUILD_WORKER

// Cap concurrent build-worker children so the isolation cannot oversubscribe a
// constrained machine (an unbounded spawn storm under the a11y scanner + e2e
// workers is what regressed CI in the earlier subprocess attempt). Overridable.
const BUILD_CONCURRENCY = (() => {
  const env = Number(process.env.DISPLAY_CASE_BUILD_CONCURRENCY)
  if (Number.isFinite(env) && env >= 1) return Math.floor(env)
  return Math.max(1, Math.min(4, cpus().length - 1))
})()
// Upper bound on how long a single build worker (or the manifest subprocess) may
// run before it's treated as hung and killed. The crash path handles a worker that
// dies on a signal; this handles one that neither exits nor crashes — a top-level
// `await` that never resolves, a plugin that spins — which would otherwise leak its
// concurrency slot forever and silently wedge all further preparation. Generous by
// default so a legitimately large bundle on a cold, contended CI runner isn't
// killed mid-build; override via env (read per call so tests can shorten it).
export const buildTimeoutMs = (): number => {
  const env = Number(process.env.DISPLAY_CASE_BUILD_TIMEOUT)
  return Number.isFinite(env) && env >= 1 ? Math.floor(env) : 120_000
}

let buildActive = 0
const buildWaiters: Array<() => void> = []
export async function withBuildSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (buildActive >= BUILD_CONCURRENCY) {
    await new Promise<void>((res) => buildWaiters.push(res))
  }
  buildActive++
  try {
    return await fn()
  } finally {
    buildActive--
    buildWaiters.shift()?.()
  }
}

/** One bundle output a build worker wrote (publish kind needs the content-hashed
 *  entry names back to build asset URLs; the dev kinds leave this undefined). */
export interface BuildOutput {
  path: string
  kind: string
}

export interface BuildOutcome {
  ok: boolean
  inputs: string[]
  /** Present when `ok` is false. */
  error?: string
  /** The worker died on a signal (a native bundler crash), not a logical error. */
  crashed?: boolean
  /** The bundle outputs the worker wrote (publish kind only). */
  outputs?: BuildOutput[]
}

/**
 * Interpret a build worker's exit into a {@link BuildOutcome}. Pure, so the
 * crash-containment logic is tested deterministically without a real segfault:
 *  - parseable `{ ok: true }`     → success;
 *  - parseable `{ ok: false }`    → a *logical* build error (not a crash);
 *  - no JSON + a `signal`         → a native bundler **crash** (the heap bug);
 *  - no JSON + a non-zero `code`  → an abnormal exit (e.g. bad args), not a crash.
 */
export function classifyBuildResult(
  stdout: string,
  code: number | null,
  signal: string | null,
): BuildOutcome {
  let parsed:
    | {
        ok: boolean
        inputs?: string[]
        error?: string
        outputs?: BuildOutput[]
      }
    | undefined
  try {
    parsed = JSON.parse(stdout)
  } catch {
    // No parseable result → the worker died before emitting its JSON.
  }
  if (parsed?.ok)
    return { ok: true, inputs: parsed.inputs ?? [], outputs: parsed.outputs }
  if (parsed) {
    return {
      ok: false,
      inputs: parsed.inputs ?? [],
      error: parsed.error ?? 'bundling failed',
      crashed: false,
    }
  }
  if (signal) {
    return {
      ok: false,
      inputs: [],
      error: `the bundler crashed (killed by ${signal}; a native Bun bundler bug — an oversized module graph or a linker use-after-free, not your code)`,
      crashed: true,
    }
  }
  return {
    ok: false,
    inputs: [],
    error: `bundling exited abnormally (code ${code})`,
    crashed: false,
  }
}

// In-flight build-worker children, tracked so a dev-server shutdown can kill them
// rather than orphaning live `bun` bundler children. Each is removed as it exits.
const activeWorkers = new Set<ReturnType<typeof Bun.spawn>>()

/**
 * Kill every in-flight build worker. Called on dev-server teardown (SIGINT/SIGTERM)
 * so a Ctrl-C doesn't leave orphaned bundler children behind.
 */
export function killActiveBuildWorkers(): void {
  for (const proc of activeWorkers) proc.kill()
  activeWorkers.clear()
}

/**
 * Spawn the build worker for one build and await it. NEVER calls `Bun.build` in
 * this process. A worker that dies on a signal (a Bun bundler segfault) is
 * reported as a crash attributed to that surface, so the native panic is
 * contained here instead of taking the caller down. The slot cap bounds how many
 * children run at once.
 */
export async function spawnBuildWorker(args: string[]): Promise<BuildOutcome> {
  return withBuildSlot(async () => {
    const proc = Bun.spawn(['bun', buildWorkerPath(), ...args], {
      stdout: 'pipe',
      stderr: 'pipe',
    })
    activeWorkers.add(proc)
    const collect = Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<null>((res) => {
      timer = setTimeout(() => res(null), buildTimeoutMs())
    })
    try {
      // Race the worker against the timeout. A worker that hangs is killed and
      // reported as a contained per-surface failure (not a crash, not a stall) —
      // the same guarantee the signal path gives, for the third failure mode.
      const done = await Promise.race([collect, timeout])
      if (done === null) {
        proc.kill() // unblocks `collect`; its result is now irrelevant
        return {
          ok: false,
          inputs: [],
          error: `the bundler hung (no result within ${buildTimeoutMs()}ms; killed)`,
          crashed: false,
        }
      }
      const [out, errText, code] = done
      if (errText.trim()) {
        process.stderr.write(errText.endsWith('\n') ? errText : `${errText}\n`)
      }
      return classifyBuildResult(out, code, proc.signalCode)
    } finally {
      if (timer) clearTimeout(timer)
      void collect.catch(() => {}) // swallow the post-kill resolution/rejection
      activeWorkers.delete(proc)
    }
  })
}
