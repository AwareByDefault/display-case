import { join } from 'node:path'
import {
  cacheDir,
  codegenCaseRenderEntry,
  codegenCaseSsrEntry,
} from '../core/discovery'
import { graphRecorder } from '../core/graph-recorder'
import { mdxPlugin } from '../core/mdx-plugin'
import { pinReact } from '../core/pin-react'

/**
 * Builds one component's bundles on demand (see `buildCase` in server.ts), called
 * in-process so there is no per-build process spawn — a cold `bun` start per
 * build is pathologically slow under a contended CI runner already saturated by
 * the a11y scanner's browser and the e2e workers. Bun's bundler can in principle
 * segfault on a very large graph, but per-component bundling keeps each graph
 * small (the report's individual heavy cases all built fine; only the *aggregate*
 * catalog crashed), so that does not arise here. A *build error* (an unresolved
 * import, a syntax error) is caught and returned as `{ ok: false, error }`, which
 * the server surfaces as a per-case diagnostic while every other component keeps
 * serving. The build is factored out here so it is unit-testable directly.
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
export async function publicEnvDefines(
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
 * `<cache>/dist/render-case-<id>.js`) and in-process SSR bundle (→
 * `<cache>/ssr/ssr-case-<id>-<seq>.js`). Returns the recorded module-graph
 * inputs. A *build failure* is returned as `{ ok: false }`; a native bundler
 * crash is uncatchable and would take the (single, in-process) server down — per
 * component graphs are kept small enough that it does not arise.
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
    // as a structured failure. (A native bundler *crash* is uncatchable and would
    // take the in-process server down instead — see the module comment.)
    return {
      ok: false,
      inputs: [...inputs],
      error: err instanceof Error ? (err.message ?? String(err)) : String(err),
    }
  }
}
