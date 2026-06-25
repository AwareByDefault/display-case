import { join, resolve } from 'node:path'
import {
  cacheDir,
  codegenCaseRenderEntry,
  codegenCaseSsrEntry,
  codegenPrimerEntry,
  codegenSsrPrimerEntry,
} from '../core/discovery'
import { graphRecorder } from '../core/graph-recorder'
import { mdxPlugin } from '../core/mdx-plugin'
import { pinReact } from '../core/pin-react'

/**
 * The **build worker**: every `Bun.build` Display Case runs for the dev server
 * happens here, spawned by `server.ts` as a short-lived child process (`bun
 * build-case.ts <kind> …`, see the `import.meta.main` block below) — never in the
 * long-lived server. This is the generalization of `loadManifestFresh`: the
 * worker's bundler heap dies with the process, so the server never accumulates the
 * bundler heap state that corrupts and segfaults on a large catalog ("a bug in
 * Bun, not your code"). The server only orchestrates the spawn and serves the
 * bytes the worker wrote to the `.display-case/` cache.
 *
 * Two build kinds: `shell` (the browse chrome + optional primer) and `case` (one
 * component's browser + SSR bundle). Each emits `{ ok, inputs, error? }` JSON on
 * stdout. A *build error* (an unresolved import) is `{ ok: false }`; a Bun bundler
 * *crash* kills the worker (a signal exit with no JSON), which the parent detects
 * and attributes to that surface instead of inheriting the panic. The functions
 * are also exported so they are unit-testable directly.
 */

/**
 * Build a `Bun.build` `define` map that inlines the consumer's public env
 * (`BUN_PUBLIC_*`) into the browser bundle — the same values the app's own
 * production build inlines (`bun build … --env='BUN_PUBLIC_*'`).
 *
 * Why `define` and not `Bun.build({ env: 'BUN_PUBLIC_*' })`: the `env` option
 * only inlines vars present in the environment Bun snapshotted at *process*
 * startup (plus the CWD-relative `.env` Bun auto-loads). Display Case runs from
 * the repo root, not the consumer package, so a public var defined only in
 * `<pkg>/.env` (e.g. the API base URL) is absent at build time — and mutating
 * `process.env` at runtime does not influence it. Left unreplaced, a
 * `process.env.BUN_PUBLIC_*` read survives as a literal that throws
 * `process is not defined` in the browser. `define` replaces the literal
 * unconditionally, independent of env timing.
 *
 * Scoped strictly to the public prefix so non-public env (secrets, NODE_ENV,
 * ports) never enters the bundle. A real exported `process.env` value wins over
 * the file so local overrides still apply.
 */
async function publicEnvDefines(
  pkgDir: string,
): Promise<Record<string, string>> {
  const values = new Map<string, string>()
  for (const name of ['.env', '.env.local']) {
    const file = Bun.file(join(pkgDir, name))
    if (!(await file.exists())) continue
    for (const raw of (await file.text()).split('\n')) {
      const line = raw.trim()
      if (!line || line.startsWith('#')) continue
      const eq = line.indexOf('=')
      if (eq === -1) continue
      const key = line
        .slice(0, eq)
        .replace(/^export\s+/, '')
        .trim()
      if (!key.startsWith('BUN_PUBLIC_')) continue
      let value = line.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      values.set(key, value)
    }
  }
  // A real exported env value overrides the file (local override wins).
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('BUN_PUBLIC_') && value !== undefined) {
      values.set(key, value)
    }
  }
  const defines: Record<string, string> = {}
  for (const [key, value] of values) {
    defines[`process.env.${key}`] = JSON.stringify(value)
  }
  return defines
}

export interface BuildCaseArgs {
  pkgDir: string
  file: string
  configPath: string
  componentId: string
  /** Sequence suffix so the SSR bundle gets a fresh on-disk name each build (Bun
   *  caches `import()` by resolved path). `buildCase` imports the matching file. */
  seq: number
}

export interface BuildCaseResult {
  ok: boolean
  /** Absolute paths the build read — the component's real module graph, so the
   *  dev watcher can follow source-resolved deps. */
  inputs: string[]
  /** Present when `ok` is false: the bundler logs explaining the build failure. */
  error?: string
}

/**
 * Codegen and build one component's browser render bundle (→
 * `<cache>/dist/render-case-<id>.js`) and SSR bundle (→
 * `<cache>/ssr/ssr-case-<id>-<seq>.js`). Returns the recorded module-graph inputs.
 * A *build failure* is returned as `{ ok: false }`; a native bundler crash kills
 * the worker process (which is the point of running it as a child).
 */
export async function buildCaseBundles(
  args: BuildCaseArgs,
): Promise<BuildCaseResult> {
  const { pkgDir, file, configPath, componentId, seq } = args
  const inputs = new Set<string>()
  const outdir = join(cacheDir(pkgDir), 'dist')
  const ssrOutDir = join(cacheDir(pkgDir), 'ssr')
  try {
    const define = await publicEnvDefines(pkgDir)

    const renderEntry = await codegenCaseRenderEntry(
      pkgDir,
      file,
      configPath,
      componentId,
    )
    const browser = await Bun.build({
      entrypoints: [renderEntry],
      outdir,
      target: 'browser',
      plugins: [graphRecorder(inputs), mdxPlugin(), pinReact(pkgDir)],
      define,
      naming: {
        entry: '[name].[ext]',
        chunk: '[name]-[hash].[ext]',
        asset: '[name]-[hash].[ext]',
      },
    })
    if (!browser.success) {
      return {
        ok: false,
        inputs: [...inputs],
        error: browser.logs.map(String).join('\n') || 'browser bundle failed',
      }
    }

    const ssrEntry = await codegenCaseSsrEntry(
      pkgDir,
      file,
      configPath,
      componentId,
      seq,
    )
    const ssr = await Bun.build({
      entrypoints: [ssrEntry],
      outdir: ssrOutDir,
      target: 'bun',
      plugins: [graphRecorder(inputs), mdxPlugin(), pinReact(pkgDir)],
      define,
      naming: {
        entry: `ssr-case-${componentId}-${seq}.[ext]`,
        chunk: '[name]-[hash].[ext]',
        asset: '[name]-[hash].[ext]',
      },
    })
    if (!ssr.success) {
      return {
        ok: false,
        inputs: [...inputs],
        error: ssr.logs.map(String).join('\n') || 'SSR bundle failed',
      }
    }

    return { ok: true, inputs: [...inputs] }
  } catch (err) {
    // Bun.build *rejects* (rather than returning `success: false`) for some
    // failures — an unresolvable import, a syntax error in the graph. Report it
    // as a structured failure. (A native bundler *crash* kills the worker; the
    // parent sees the signal exit — see the module comment.)
    return {
      ok: false,
      inputs: [...inputs],
      error: err instanceof Error ? (err.message ?? String(err)) : String(err),
    }
  }
}

export interface BuildShellArgs {
  pkgDir: string
  configPath: string
  /** The config's `primer` value (package-relative), or null when no primer. */
  primerPath: string | null
  /** Sequence suffix for the primer SSR bundle's on-disk name (see seq above). */
  seq: number
}

const HERE = resolve(import.meta.dir, '..')
const BROWSER_ENTRY = join(HERE, 'ui', 'browser-entry.tsx')

/**
 * Build the browse chrome (`browser-entry`) plus, when configured, the primer's
 * browser entry and its SSR entry — the catalog-size-independent startup bundles.
 * Mirrors the per-case worker: outputs to the `.display-case/` cache, returns the
 * recorded module graph. The chrome carries no case modules, so this graph is
 * small; running it in the worker (not the server) is what keeps the bundler heap
 * out of the long-lived process entirely.
 */
export async function buildShellBundles(
  args: BuildShellArgs,
): Promise<BuildCaseResult> {
  const { pkgDir, configPath, primerPath, seq } = args
  const inputs = new Set<string>()
  const outdir = join(cacheDir(pkgDir), 'dist')
  const ssrOutDir = join(cacheDir(pkgDir), 'ssr')
  try {
    const define = await publicEnvDefines(pkgDir)
    const primerEntry = primerPath
      ? await codegenPrimerEntry(pkgDir, primerPath)
      : null
    const entrypoints = [BROWSER_ENTRY]
    if (primerEntry) entrypoints.push(primerEntry)
    const browser = await Bun.build({
      entrypoints,
      outdir,
      target: 'browser',
      plugins: [graphRecorder(inputs), mdxPlugin(), pinReact(pkgDir)],
      define,
      naming: {
        entry: '[name].[ext]',
        chunk: '[name]-[hash].[ext]',
        asset: '[name]-[hash].[ext]',
      },
    })
    if (!browser.success) {
      return {
        ok: false,
        inputs: [...inputs],
        error: browser.logs.map(String).join('\n') || 'shell bundle failed',
      }
    }
    if (primerPath) {
      const ssrPrimerEntry = await codegenSsrPrimerEntry(
        pkgDir,
        primerPath,
        configPath,
      )
      const ssr = await Bun.build({
        entrypoints: [ssrPrimerEntry],
        outdir: ssrOutDir,
        target: 'bun',
        plugins: [graphRecorder(inputs), mdxPlugin(), pinReact(pkgDir)],
        define,
        naming: {
          entry: `ssr-primer-entry-${seq}.[ext]`,
          chunk: '[name]-[hash].[ext]',
          asset: '[name]-[hash].[ext]',
        },
      })
      if (!ssr.success) {
        return {
          ok: false,
          inputs: [...inputs],
          error: ssr.logs.map(String).join('\n') || 'primer SSR bundle failed',
        }
      }
    }
    return { ok: true, inputs: [...inputs] }
  } catch (err) {
    return {
      ok: false,
      inputs: [...inputs],
      error: err instanceof Error ? (err.message ?? String(err)) : String(err),
    }
  }
}

// Worker entry: `bun build-case.ts <kind> …`. Emits the JSON result on stdout and
// exits 0 (built) / 1 (build error) / 2 (bad args). A native bundler crash exits
// abnormally with no stdout — the parent treats either as a per-surface failure.
if (import.meta.main) {
  const [kind, ...rest] = process.argv.slice(2)
  const badArgs = (): never => {
    process.stderr.write(`build-case: bad args for kind '${kind}'\n`)
    process.exit(2)
  }
  let result: BuildCaseResult
  if (kind === 'case') {
    // <pkgDir> <file> <configPath> <componentId> <seq>
    const [pkgDir, file, configPath, componentId, seqStr] = rest
    if (!pkgDir || !file || !configPath || !componentId || !seqStr) badArgs()
    result = await buildCaseBundles({
      pkgDir,
      file,
      configPath,
      componentId,
      seq: Number(seqStr),
    })
  } else if (kind === 'shell') {
    // <pkgDir> <configPath> <primerPath|""> <seq>
    const [pkgDir, configPath, primerPath, seqStr] = rest
    if (!pkgDir || !configPath || primerPath === undefined || !seqStr) badArgs()
    result = await buildShellBundles({
      pkgDir,
      configPath,
      primerPath: primerPath || null,
      seq: Number(seqStr),
    })
  } else {
    process.stderr.write(`build-case: unknown build kind '${kind}'\n`)
    process.exit(2)
  }
  process.stdout.write(JSON.stringify(result))
  process.exit(result.ok ? 0 : 1)
}
