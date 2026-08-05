import { join } from 'node:path'
import { findCase, slugify } from '../core/catalog'
import {
  cacheDir,
  discoverCaseFiles,
  loadModules,
  resolveConfig,
} from '../core/discovery'
import type { Substrate } from '../core/substrate'
import type { CaseRenderer } from '../render/ssr-render'
import { spawnBuildWorker } from '../server/build-runner'
import { renderVariants, resolveSubstrate } from '../substrate/resolve'

/**
 * `display-case render <component>/<case>` — print a case's serialized frame.
 *
 * This is the browserless capture path. The substrate renders the case
 * headlessly and serializes it, and the bytes go to stdout (or a file): no
 * server is started, no browser is launched, and nothing is screenshotted.
 *
 * For an agent that is the point. Against the DOM substrate it prints the same
 * chrome-free document the `/render` address serves, without the round trip.
 * Against a substrate that serializes to text — a terminal renderer's frame —
 * it prints something an agent *reads directly*, with no image and no vision
 * model in the loop.
 */

export interface RenderOptions {
  /** `<component>/<case>`, by slug — the same ids the manifest lists. */
  target: string
  /** Render-axis values, as `--variant=theme=dark` (repeatable). Unspecified
   *  axes take their declared default. */
  variants: string[]
  /** Tweak values, as `--tweak size=lg` (repeatable). */
  tweaks: string[]
  /** Write to this path instead of stdout. */
  out?: string
}

export interface RenderResult {
  bytes: Uint8Array
  /** The substrate's file extension for these bytes (`html`, `txt`, `ansi`). */
  ext: string
  /** True when the case could not be rendered headlessly — it needs the stage
   *  runtime — so the frame is empty rather than wrong. */
  browserOnly: boolean
  /** The reason, when the case declined to render headlessly. */
  error?: string
  /** The resolved render-axis values the frame was produced under. */
  variants: Record<string, string>
}

/** Parse repeated `k=v` arguments into a map, rejecting malformed entries. */
function parsePairs(pairs: string[], label: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const pair of pairs) {
    const eq = pair.indexOf('=')
    if (eq <= 0) {
      throw new Error(
        `Malformed --${label} "${pair}" — expected ${label}=value, e.g. --${label}=theme=dark.`,
      )
    }
    out[pair.slice(0, eq)] = pair.slice(eq + 1)
  }
  return out
}

/**
 * Render one case to serialized bytes, with no server and no browser.
 *
 * The per-component SSR bundle is built the same way the dev server builds it —
 * in an isolated worker, so one component's graph can never take down the tool
 * — then imported and invoked. That reuse is deliberate: the frame this prints
 * has to be the frame the render address serves, or a snapshot taken here would
 * not describe what the showcase shows.
 */
export async function renderCase(
  pkgDir: string,
  opts: RenderOptions,
): Promise<RenderResult> {
  const slash = opts.target.indexOf('/')
  if (slash <= 0 || slash === opts.target.length - 1) {
    throw new Error(
      `Expected <component>/<case>, got "${opts.target}". ` +
        `Run \`display-case ${pkgDir} --print-manifest\` to list the ids.`,
    )
  }
  const componentId = opts.target.slice(0, slash)
  const caseId = opts.target.slice(slash + 1)

  const { config, configPath } = await resolveConfig(pkgDir)
  const substrate: Substrate = resolveSubstrate(config)

  // Locate the one case file that owns this component, so only its graph is
  // built — the catalog is never bundled as a whole.
  const files = await discoverCaseFiles(pkgDir, config)
  const { modules } = await loadModules(files)
  const owner = modules.find((m) => slugify(m.module.component) === componentId)
  if (!owner) {
    throw new Error(
      `No component "${componentId}" in ${pkgDir}. ` +
        `Run \`display-case ${pkgDir} --print-manifest\` to list the ids.`,
    )
  }
  if (!findCase([owner.module], componentId, caseId)) {
    const known = Object.keys(owner.module.cases).map(slugify).join(', ')
    throw new Error(
      `No case "${caseId}" on component "${componentId}". Known cases: ${known}.`,
    )
  }

  // Build this one component through the same isolated worker the dev server
  // uses, so a component whose graph crashes the bundler is a contained failure
  // here too — and so the frame printed is the frame the render address serves.
  const seq = Date.now()
  const built = await spawnBuildWorker([
    'case',
    pkgDir,
    owner.file,
    configPath,
    componentId,
    String(seq),
  ])
  if (!built.ok) {
    throw new Error(
      `Could not build the renderer for "${componentId}": ${built.error}`,
    )
  }

  const ssrPath = join(
    cacheDir(pkgDir),
    'ssr',
    `ssr-case-${componentId}-${seq}.js`,
  )
  const mod = (await import(ssrPath)) as {
    renderCaseToHtml: CaseRenderer
  }
  const variants = {
    ...renderVariants(new URLSearchParams(), substrate),
    ...parsePairs(opts.variants, 'variant'),
  }
  const tweaks = parsePairs(opts.tweaks, 'tweak')
  const result = await mod.renderCaseToHtml(
    { componentId, caseId, width: null, tweaks },
    variants,
    {},
  )
  const { bytes, ext } = substrate.serialize(result.frame)
  return {
    bytes,
    ext,
    browserOnly: result.browserOnly,
    error: result.error,
    variants,
  }
}

/** CLI entry: render, then write the bytes to stdout or a file. */
export async function runRender(
  pkgDir: string,
  opts: RenderOptions,
): Promise<number> {
  const result = await renderCase(pkgDir, opts)
  if (opts.out) {
    await Bun.write(opts.out, result.bytes)
    console.error(`  Wrote ${result.bytes.length} bytes → ${opts.out}`)
  } else {
    await Bun.write(Bun.stdout, result.bytes)
  }
  // A case that needs the stage runtime produced an empty frame; say so on
  // stderr (stdout stays exactly the frame) and exit non-zero, so a script that
  // captured nothing does not mistake it for a successful capture.
  if (result.browserOnly) {
    console.error(
      `  ⚠ ${opts.target} can't render headlessly${result.error ? ` (${result.error})` : ''}; ` +
        `the frame is empty and only the stage runtime can paint it.`,
    )
    return 1
  }
  return 0
}
