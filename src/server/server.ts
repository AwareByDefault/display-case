import { existsSync } from 'node:fs'
import { createServer } from 'node:net'
import { join, relative, resolve } from 'node:path'
import {
  type A11yScanner,
  type A11yScanStatus,
  createA11yScanner,
} from '../checks/a11y-scanner'
import { buildCatalog, slugify } from '../core/catalog'
import type { LoadedModule } from '../core/discovery'
import {
  cacheDir,
  codegenPrimerEntry,
  codegenRenderEntry,
  codegenSsrEntry,
  codegenSsrPrimerEntry,
  discoverCaseFiles,
  loadModules,
  resolveConfig,
} from '../core/discovery'
import {
  findWatchRoot,
  graphRecorder,
  graphWatchDirs,
} from '../core/graph-recorder'
import { buildGroupTree, makeGroupResolver } from '../core/groups'
import type { BrowseMode, Manifest } from '../core/manifest'
import { mdxPlugin } from '../core/mdx-plugin'
import { pinReact } from '../core/pin-react'
import { type DisplayCaseConfig, isSurfaceLevel } from '../index'
import type { PrimerHtmlResult } from '../render/ssr-primer'
import type { CaseRenderer } from '../render/ssr-render'
import { renderShellToHtml } from '../render/ssr-shell'
import type { Theme } from '../ui/shell-core'

const HERE = resolve(import.meta.dir, '..')
const BROWSER_ENTRY = join(HERE, 'ui', 'browser-entry.tsx')
const CHROME_CSS = join(HERE, 'ui', 'chrome.css')
const CLI = join(HERE, 'cli.ts')

// The package's own design system — "The Vitrine". Display Case dogfoods it:
// the browse chrome is styled entirely from these `--dc-*` tokens. The token
// files are inlined (in @import order, fonts excluded) ahead of chrome.css; the
// webfonts load via the <link>s below so the declaration leads the document and
// never fights a consumer's stylesheet @imports. See ui/design-system/.
const DS_DIR = join(HERE, 'ui', 'design-system', 'tokens')
const DS_TOKEN_FILES = ['colors.css', 'typography.css', 'spacing.css']
const FONT_LINKS =
  '<link rel="preconnect" href="https://fonts.googleapis.com"/>' +
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>' +
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"/>'

async function readDesignTokens(): Promise<string> {
  const parts = await Promise.all(
    DS_TOKEN_FILES.map((f) => Bun.file(join(DS_DIR, f)).text()),
  )
  return parts.join('\n')
}

// The Vitrine's own chrome stylesheet, assembled by reading and concatenating
// (in path-sorted order) the shell layout (chrome.css), every design-system
// component's co-located CSS, and the primer chrome's CSS. The design-system
// components no longer inject their CSS at runtime; this blob is inlined into
// every document head so the chrome paints before scripts run. Mirrors
// readDesignTokens (read N files, join) — no bundler step, no JS-graph import.
const COMPONENTS_DIR = join(HERE, 'ui', 'design-system', 'components')
const PRIMER_CSS = join(HERE, 'ui', 'primer.css')

async function readVitrineCss(): Promise<string> {
  const componentFiles: string[] = []
  for await (const f of new Bun.Glob('**/*.css').scan({
    cwd: COMPONENTS_DIR,
    absolute: true,
  })) {
    componentFiles.push(f)
  }
  componentFiles.sort()
  const files = [CHROME_CSS, ...componentFiles]
  if (existsSync(PRIMER_CSS)) files.push(PRIMER_CSS)
  const parts = await Promise.all(files.map((f) => Bun.file(f).text()))
  return parts.join('\n')
}

/** Walk up from this package to find the repo root (nearest dir with `.git`). */
function findRepoRoot(): string {
  let dir = HERE
  for (let i = 0; i < 12; i++) {
    if (existsSync(join(dir, '.git'))) return dir
    const parent = resolve(dir, '..')
    if (parent === dir) break
    dir = parent
  }
  return process.cwd()
}

const REPO_ROOT = findRepoRoot()

interface BuiltState {
  manifest: Manifest
  /** component id → absolute placard-doc path (only present when a doc exists). */
  placardById: Map<string, string>
  /** Concatenated consumer global stylesheet contents. */
  globalCss: string
  /** Pre-render a case to markup for the isolated `/render` document. Rebuilt
   *  fresh each rebuild so its case modules track edits (see `rebuild`). */
  renderCase: CaseRenderer
  /** Pre-render the primer to markup, or null when no primer is configured. */
  renderPrimer: (() => PrimerHtmlResult) | null
  /** Absolute paths of every on-disk file the bundles read this build — the
   *  actual module graph, transitive workspace-sibling source included. The dev
   *  watcher follows this so editing a source-resolved dependency rebuilds. */
  inputs: Set<string>
}

// Monotonic suffix for the SSR bundle's filename. Bun caches `import()` by
// resolved path and ignores `?v=` busting, so each rebuild must write — and
// import — a uniquely-named bundle to pick up edited case source. (The browser
// render bundle is always fresh because `Bun.build` re-reads from disk; this is
// the in-process import equivalent of that freshness.)
let ssrBuildSeq = 0

function relPath(p: string): string {
  return relative(REPO_ROOT, p)
}

/** Absolute path of the configured primer `.mdx`, or null if none/missing. */
function primerFile(pkgDir: string, config: DisplayCaseConfig): string | null {
  if (!config.primer) return null
  const abs = resolve(pkgDir, config.primer)
  return existsSync(abs) ? abs : null
}

function buildManifest(
  pkgDir: string,
  modules: LoadedModule[],
  config: DisplayCaseConfig,
  hasPrimer: boolean,
): { manifest: Manifest; placardById: Map<string, string> } {
  const fileByComponent = new Map(
    modules.map((m) => [m.module.component, m.file]),
  )
  // The manifest-building load path (loadModules) doesn't tag modules with their
  // source path the way the codegen'd bundles do, so set it here — group
  // resolution and the decorator both key off it. Package-relative, matching the
  // `roots` globs.
  for (const m of modules) {
    if (m.module.sourcePath == null)
      m.module.sourcePath = relative(pkgDir, m.file)
  }
  const placardById = new Map<string, string>()
  const resolveGroup = makeGroupResolver(config)
  const catalog = buildCatalog(
    modules.map((m) => m.module),
    resolveGroup,
  )

  const components = catalog.map((c) => {
    const file = fileByComponent.get(c.name) as string
    const placardAbs = file.replace(/\.case\.tsx?$/, '.placard.md')
    const hasDoc = existsSync(placardAbs)
    if (hasDoc) placardById.set(c.id, placardAbs)
    return {
      id: c.id,
      name: c.name,
      level: c.level,
      isFlow: c.isFlow,
      group: c.group,
      caseFile: relPath(file),
      placardDoc: hasDoc ? relPath(placardAbs) : null,
      cases: c.cases.map((cs) => ({
        id: cs.id,
        name: cs.name,
        // The mode is the path prefix: `/e/` for an Exhibits surface, `/c/` for
        // a Components (kit) case. The render endpoint stays unified.
        browseUrl: `/${isSurfaceLevel(c.level) ? 'e' : 'c'}/${c.id}/${cs.id}`,
        renderUrl: `/render/${c.id}/${cs.id}`,
        tweaks: cs.tweaks,
        transitions: cs.transitions,
      })),
    }
  })

  // The present modes, in canonical order: a mode is offered only when it has
  // content (a primer; ≥1 building-block component; ≥1 page/flow surface).
  const hasKit = catalog.some((c) => !isSurfaceLevel(c.level))
  const hasSurfaces = catalog.some((c) => isSurfaceLevel(c.level))
  const modes: BrowseMode[] = []
  if (hasPrimer) modes.push('primer')
  if (hasKit) modes.push('components')
  if (hasSurfaces) modes.push('exhibits')

  // Land on the configured mode when it's present; otherwise the first present
  // mode (primer → components → exhibits). With no config and a primer present,
  // this lands on the primer, as before.
  const want = config.landing
  const landing: BrowseMode =
    want && modes.includes(want) ? want : (modes[0] ?? 'components')

  const groups = buildGroupTree(catalog, config)

  return {
    manifest: {
      title: config.title,
      components,
      groups,
      modes,
      landing,
      flowMarker: config.nav?.flowMarker ?? 'tag',
    },
    placardById,
  }
}

async function readGlobalCss(
  pkgDir: string,
  config: DisplayCaseConfig,
): Promise<string> {
  const parts: string[] = []
  for (const rel of config.globalStyles ?? []) {
    const abs = resolve(pkgDir, rel)
    if (await Bun.file(abs).exists()) parts.push(await Bun.file(abs).text())
  }
  return parts.join('\n')
}

/**
 * Build the manifest in a fresh subprocess. Bun caches ES modules by resolved
 * path for the life of a process (a `?v=` query does not bust it), so an
 * in-process re-import after an edit would return the stale module — the
 * manifest shape (case order/names, level, tweak schema) would never update on
 * a watch rebuild. Spawning `--print-manifest` gives a clean module graph each
 * time; the child's stderr (load errors) is relayed to ours.
 */
async function loadManifestFresh(pkgDir: string): Promise<Manifest> {
  const proc = Bun.spawn(['bun', CLI, pkgDir, '--print-manifest'], {
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  if (err.trim()) process.stderr.write(err.endsWith('\n') ? err : `${err}\n`)
  if (code !== 0) {
    throw new Error(`manifest build subprocess exited with code ${code}`)
  }
  return JSON.parse(out) as Manifest
}

/** Discover, codegen, bundle, and assemble the served state. */
async function rebuild(
  pkgDir: string,
  config: DisplayCaseConfig,
  configPath: string,
): Promise<BuiltState> {
  const files = await discoverCaseFiles(pkgDir, config)
  // Collect the real module graph across every bundle pass (render, SSR, and the
  // primer) so the dev watcher can follow source-resolved workspace deps. The
  // recorder is registered first in each plugin list so MDX-handled paths land
  // here too. See graphRecorder.
  const inputs = new Set<string>()

  const renderEntry = await codegenRenderEntry(pkgDir, files, configPath)
  const outdir = join(cacheDir(pkgDir), 'dist')
  // The Primer is its own isolated document (like /render), so it's a separate
  // bundle entry — keeping the consumer's `.mdx` and the arbitrary components it
  // imports out of the browse chrome's bundle.
  const primerSrc = primerFile(pkgDir, config)
  const primerEntry = primerSrc
    ? await codegenPrimerEntry(pkgDir, config.primer as string)
    : null
  const entrypoints = [BROWSER_ENTRY, renderEntry]
  if (primerEntry) entrypoints.push(primerEntry)
  const result = await Bun.build({
    entrypoints,
    outdir,
    target: 'browser',
    // The MDX plugin compiles the primer's `.mdx` (and any `.mdx` it imports)
    // to JS on load; it's a no-op for builds without a primer entry. pinReact
    // collapses Display Case's render runtime and the consumer's components onto
    // a single React copy — see pinReact for the dual-React bug it prevents.
    plugins: [graphRecorder(inputs), mdxPlugin(), pinReact(pkgDir)],
    // Inline the consumer's public env (BUN_PUBLIC_*) so a `process.env.*` read
    // in bundled code (e.g. the API base URL) doesn't survive as a literal that
    // throws `process is not defined` in the browser. See publicEnvDefines.
    define: await publicEnvDefines(pkgDir),
    naming: {
      entry: '[name].[ext]',
      chunk: '[name]-[hash].[ext]',
      asset: '[name]-[hash].[ext]',
    },
  })
  if (!result.success) {
    for (const log of result.logs) console.error(log)
    throw new Error('Display Case bundle failed')
  }

  // Pre-render bundle: the same case import list as the browser render bundle,
  // but built for Bun and imported in-process so the server can render a case to
  // markup before delivering its document. Built to a fresh, sequence-named file
  // each rebuild because Bun caches imports by resolved path — a stable name
  // would return the stale renderer after an edit (the same staleness that forces
  // the manifest into a subprocess). The bundle inlines case source from disk, so
  // importing the fresh file yields current modules. pinReact bundles the
  // consumer's React (instead of leaving it external) so `renderToString` and
  // the consumer's components share one React — the same dual-React hazard the
  // browser bundle faces, here for the in-process server render.
  const ssrEntry = await codegenSsrEntry(pkgDir, files, configPath)
  const ssrOutDir = join(cacheDir(pkgDir), 'ssr')
  const ssrName = `ssr-entry-${++ssrBuildSeq}`
  const ssrResult = await Bun.build({
    entrypoints: [ssrEntry],
    outdir: ssrOutDir,
    target: 'bun',
    plugins: [graphRecorder(inputs), mdxPlugin(), pinReact(pkgDir)],
    define: await publicEnvDefines(pkgDir),
    naming: {
      entry: `${ssrName}.[ext]`,
      chunk: '[name]-[hash].[ext]',
      asset: '[name]-[hash].[ext]',
    },
  })
  if (!ssrResult.success) {
    for (const log of ssrResult.logs) console.error(log)
    throw new Error('Display Case SSR bundle failed')
  }
  const ssrModule = (await import(join(ssrOutDir, `${ssrName}.js`))) as {
    renderCaseToHtml: CaseRenderer
  }
  const renderCase = ssrModule.renderCaseToHtml

  // Pre-render bundle for the primer, built and imported the same way (and only
  // when a primer is configured). Its specimens are real consumer components, so
  // — like a case — one may be browser-only; the renderer reports that and the
  // server falls back to client-rendering the whole primer.
  let renderPrimer: (() => PrimerHtmlResult) | null = null
  if (primerSrc) {
    const ssrPrimerEntry = await codegenSsrPrimerEntry(
      pkgDir,
      config.primer as string,
      configPath,
    )
    const ssrPrimerName = `ssr-primer-entry-${ssrBuildSeq}`
    const ssrPrimerResult = await Bun.build({
      entrypoints: [ssrPrimerEntry],
      outdir: ssrOutDir,
      target: 'bun',
      plugins: [graphRecorder(inputs), mdxPlugin(), pinReact(pkgDir)],
      define: await publicEnvDefines(pkgDir),
      naming: {
        entry: `${ssrPrimerName}.[ext]`,
        chunk: '[name]-[hash].[ext]',
        asset: '[name]-[hash].[ext]',
      },
    })
    if (!ssrPrimerResult.success) {
      for (const log of ssrPrimerResult.logs) console.error(log)
      throw new Error('Display Case SSR primer bundle failed')
    }
    const ssrPrimerModule = (await import(
      join(ssrOutDir, `${ssrPrimerName}.js`)
    )) as { renderPrimerToHtml: () => PrimerHtmlResult }
    renderPrimer = ssrPrimerModule.renderPrimerToHtml
  }

  // The render bundle above is rebuilt fresh from disk by Bun.build; the
  // manifest comes from a fresh subprocess for the same reason (see above).
  const manifest = await loadManifestFresh(pkgDir)
  const placardById = new Map<string, string>()
  for (const c of manifest.components) {
    if (c.placardDoc) placardById.set(c.id, resolve(REPO_ROOT, c.placardDoc))
  }
  const globalCss = await readGlobalCss(pkgDir, config)
  console.log(
    `  ${manifest.components.length} component(s), ${manifest.components.reduce((n, c) => n + c.cases.length, 0)} case(s)`,
  )
  return { manifest, placardById, globalCss, renderCase, renderPrimer, inputs }
}

/**
 * A classic (non-module) inline script that runs *before* the deferred module
 * bundle. If a bundled module references a Node/Bun runtime global that is
 * undefined in the browser (`process`/`Bun`), it throws during module
 * evaluation — before React mounts, and before any error boundary or module-level
 * handler exists — so every case would otherwise blank *silently*. This catches
 * that uncaught error and paints a visible, explained banner instead. The same
 * impurity is caught statically by the `page-component-purity` lint; this is the
 * runtime backstop for anything that slips through (or a non-app package).
 */
const ERROR_OVERLAY_SCRIPT = `<script>
window.addEventListener('error', function (e) {
  var m = (e && e.message) || '';
  if (!/\\b(process|Bun) is not defined\\b/.test(m)) return;
  var root = document.getElementById('root');
  if (root && !root.firstChild) {
    root.innerHTML =
      '<div style="margin:2rem;padding:1rem 1.25rem;border:1px solid #c00;border-radius:8px;font-family:ui-monospace,monospace;font-size:13px;line-height:1.5;color:#c00;background:#fff5f5">' +
      '<strong>Display Case bundle error</strong><br>' +
      'A showcased component (or a module it imports) references <code>' + m.replace(/ is not defined.*/, '') + '</code>, ' +
      'which is undefined in the browser bundle. It threw on load, which blanks every case.<br>' +
      'Read env/runtime values in the route (or a config module) and pass them in as props. (' + m + ')' +
      '</div>';
  }
  console.error('[display-case] runtime-global reference broke the bundle:', m);
});
</script>`

/**
 * Dev-only live-reload client. Subscribes to the `/__livereload` SSE stream and
 * reloads the page on a `reload` event (an in-process rebuild after editing the
 * Display Case app — chrome, components, primer). It also reloads when the
 * stream *reconnects* after dropping, which is how it picks up a backend change:
 * `bun --watch` restarts the server process, the stream errors, and the reload
 * fires on the fresh connection. Injected only when the server runs with `dev`.
 */
const LIVERELOAD_SCRIPT = `<script>
(function () {
  var seen = false;
  function connect() {
    var es = new EventSource('/__livereload');
    es.onopen = function () { if (seen) location.reload(); seen = true; };
    es.addEventListener('reload', function () { location.reload(); });
    es.onerror = function () { es.close(); setTimeout(connect, 400); };
  }
  connect();
})();
</script>`

/**
 * Runtime config the browse chrome reads to wire its own event stream: whether
 * live reload is on (so it refetches the manifest + reloads the iframe on a
 * rebuild — in non-dev, where there's no inline full-page reload), and whether
 * a11y surfacing is configured (so it requests + receives scan results).
 */
function clientConfigScript(cfg: {
  reload: boolean
  a11y: boolean
  dev: boolean
}): string {
  return `<script>window.__displayCase=${JSON.stringify(cfg)}</script>`
}

function shellHtml(
  title: string,
  globalCss: string,
  vitrineCss: string,
  tokensCss: string,
  liveReload: boolean,
  clientConfig: string,
  doc: { theme: Theme; markup: string; ssr: boolean; seedScript: string },
): string {
  // Reset html/body and paint the themed surface on them. The theme is baked
  // into <html> so the token background reaches the body edges from first paint
  // (and the client's hydration finds a matching theme); the shell still tracks
  // later theme toggles on the client. Background is the chrome's own `--dc-bg`
  // (the Vitrine canvas), not a consumer token. Design-system tokens lead the
  // <style> so chrome.css (last) can rely on them; the consumer's globalCss
  // styles the isolated exhibit. `data-ssr` tells the client whether to adopt
  // the rendered shell (1) or mount fresh (0). The seed (manifest/theme/a11y)
  // is inlined before the module so the client hydrates from the same data.
  const reset = 'html,body{margin:0;height:100%;background:var(--dc-bg)}'
  return `<!doctype html><html lang="en" data-theme="${doc.theme}"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${title}</title>${FONT_LINKS}<style>${tokensCss}\n${globalCss}\n${reset}\n${vitrineCss}</style></head><body><div id="root" data-ssr="${doc.ssr ? '1' : '0'}">${doc.markup}</div>${ERROR_OVERLAY_SCRIPT}${doc.seedScript}${clientConfig}${liveReload ? LIVERELOAD_SCRIPT : ''}<script type="module" src="/dist/browser-entry.js"></script></body></html>`
}

/** The document-level state the render template bakes in, mirroring what the
 *  client otherwise sets imperatively on load (theme, the decorated/transparent
 *  surface, the fit-to-content mount), plus the pre-rendered case markup. */
interface RenderDoc {
  theme: 'light' | 'dark'
  /** Drop the document background (decorated exhibit on the stage grid). */
  transparent: boolean
  /** Shrink-wrap the mount to the case's natural width. */
  fit: boolean
  /** Pre-rendered `#root` inner markup (`''` for a browser-only case). */
  markup: string
  /** Whether `markup` is present, so the client adopts instead of mounting. */
  ssr: boolean
  /** Render-time (CSS-in-JS) styling collected by the style engines, as `<head>`
   *  markup placed after the static `<style>` block. `''` when none. */
  headStyles?: string
}

/** The render state the server decodes from a `/render/...` address — the same
 *  shape `render-mount`'s `stateFromUrl` reads on the client, so the server's
 *  initial render and the client's hydration agree. */
interface ParsedRenderState extends RenderDoc {
  componentId: string
  caseId: string
  width: number | null
  tweaks: Record<string, string>
}

function parseRenderState(url: URL): ParsedRenderState {
  const parts = url.pathname.split('/').filter(Boolean) // ['render', comp, case]
  const p = url.searchParams
  const tweaks: Record<string, string> = {}
  for (const [k, v] of p) if (k.startsWith('t.')) tweaks[k.slice(2)] = v
  const widthParam = p.get('width')
  return {
    componentId: parts[1] ?? '',
    caseId: parts[2] ?? '',
    theme: p.get('theme') === 'dark' ? 'dark' : 'light',
    width: widthParam ? Number(widthParam) : null,
    tweaks,
    fit: p.get('fit') === '1',
    transparent: p.get('transparent') === '1',
    markup: '',
    ssr: false,
  }
}

function renderHtml(
  globalCss: string,
  vitrineCss: string,
  liveReload: boolean,
  doc: RenderDoc,
): string {
  // A complete document (title, lang, single <main> landmark) so the a11y runner
  // reports only real component issues, not isolated-harness chrome violations.
  // The body paints the theme surface (bg + fg) so a case renders on the same
  // background the app gives it — without this, light dark-theme text would sit
  // on a default-white body and fail contrast checks.
  // Decorated exhibits (atoms…templates, marked `data-decorated` by render-mount)
  // center their content in the frame: when the exhibit wraps or is narrower than
  // the frame, its rows sit centered rather than top-left. Inline styles on a
  // case still win, so an author can opt back to `flex-start`. Pages/flows are
  // excluded — they own their full-bleed layout and must not be re-centered.
  const exhibitCenter =
    'body[data-decorated] #root>*{justify-content:center;align-content:center}'
  // The theme, decorated surface, and fit mount are baked in so the first paint
  // is already correct (no flash, and the client's hydration finds a matching
  // tree). The client still sets them on load — idempotent — and updates them on
  // an in-place swap. `data-ssr` tells the client whether to adopt the markup
  // (1) or mount fresh (0, a browser-only case that didn't render server-side).
  const bodyAttrs = doc.transparent
    ? ' data-decorated style="background:transparent"'
    : ''
  const rootAttrs = `${doc.fit ? ' style="width:fit-content"' : ''} data-ssr="${doc.ssr ? '1' : '0'}"`
  // The Vitrine stylesheet follows globalCss so a dogfooded design-system case
  // (the showcase's own `dcui-*`/`dcpl-*`/shell components) paints before
  // scripts; its `--dc-*` tokens come from globalCss (the showcase lists the
  // token files in globalStyles). For a non-dogfooding consumer these rules are
  // inert chrome CSS — harmless in this dev-time-only preview document.
  // The style engines' collected styling (if any) follows the static <style>
  // block as its own discrete markup — emotion/styled-components tag their output
  // with attributes the client runtime keys on to adopt it, so it must not be
  // folded into the block above. Empty string when no engine is configured.
  return `<!doctype html><html lang="en" data-theme="${doc.theme}" data-theme-pref="${doc.theme}"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Display Case render</title><style>html,body{margin:0}body{background:var(--color-bg);color:var(--color-fg);font-family:var(--font-sans, ui-sans-serif, system-ui, sans-serif)}${exhibitCenter}${globalCss}\n${vitrineCss}</style>${doc.headStyles ?? ''}</head><body${bodyAttrs}><main id="root"${rootAttrs}>${doc.markup}</main>${ERROR_OVERLAY_SCRIPT}${liveReload ? LIVERELOAD_SCRIPT : ''}<script type="module" src="/dist/render-entry.js"></script></body></html>`
}

function primerHtml(
  globalCss: string,
  tokensCss: string,
  vitrineCss: string,
  liveReload: boolean,
  doc: {
    theme: 'light' | 'dark'
    markup: string
    ssr: boolean
    headStyles?: string
  },
): string {
  // The Primer's own document. It needs the Vitrine `--dc-*` tokens (the
  // reading-page + Display-card chrome paints from them), the consumer's
  // globalCss (the embedded specimens are real consumer components), and the
  // Vitrine stylesheet (the specimen + card chrome CSS, inlined server-side so
  // it paints before scripts). A single <main> landmark keeps the a11y runner
  // honest. The theme is baked into <html> so the first paint is correct; the
  // mount re-applies it (idempotent) and accepts later theme messages.
  // `data-ssr` tells the client whether to adopt the markup or mount fresh.
  const reset = 'html,body{margin:0;height:100%;background:var(--dc-bg)}'
  const rootAttrs = ` data-ssr="${doc.ssr ? '1' : '0'}"`
  // Style-engine output follows the static <style> block as discrete markup (see
  // renderHtml). `''` when no engine is configured.
  return `<!doctype html><html lang="en" data-theme="${doc.theme}" data-theme-pref="${doc.theme}"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Primer</title>${FONT_LINKS}<style>${tokensCss}\n${globalCss}\n${reset}\n${vitrineCss}</style>${doc.headStyles ?? ''}</head><body><main id="root"${rootAttrs}>${doc.markup}</main>${ERROR_OVERLAY_SCRIPT}${liveReload ? LIVERELOAD_SCRIPT : ''}<script type="module" src="/dist/primer-entry.js"></script></body></html>`
}

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
 * `process is not defined` in the browser, blanking the whole single-bundle
 * showcase (not just the case that reached it). `define` replaces the literal
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

export interface StartOptions {
  port?: number
  /**
   * Developing Display Case *itself* (not just authoring cases). Enables live
   * reload: the served documents subscribe to an SSE stream, the watcher also
   * covers the app's own source (chrome, components, primer) and re-reads the
   * inlined CSS, and a rebuild pushes a browser reload — so editing the chrome
   * hot-reloads the open page. (We don't run under `bun --watch`: re-invoking
   * `Bun.build` inside a watch process corrupts module resolution. Backend edits
   * to this server need a manual restart; the client auto-reloads on the SSE
   * reconnect that follows.) Off for normal case authoring and for `check`.
   */
  dev?: boolean
}

// Probe whether a port is bindable on localhost, without disturbing whatever
// might currently hold it.
const isPortFree = (port: number): Promise<boolean> =>
  new Promise((res) => {
    const srv = createServer()
    srv.once('error', () => res(false))
    srv.once('listening', () => srv.close(() => res(true)))
    srv.listen(port, '127.0.0.1')
  })

// Treat a requested port as *preferred*: if it is busy — e.g. another git
// worktree is already running Display Case on it — bump to the next free port so
// concurrent checkouts don't fight over one port. Falls back to the original if
// nothing nearby is free (Bun.serve then surfaces the bind error).
const firstFreePort = async (start: number): Promise<number> => {
  for (let p = start; p < start + 100; p++) {
    if (await isPortFree(p)) return p
  }
  return start
}

export async function startDisplayCase(
  pkgDir: string,
  opts: StartOptions = {},
) {
  const dev = opts.dev ?? false
  // The headless check harness runs on port 0 and wants none of the live-server
  // behaviors (watch, SSE, on-demand a11y) — it does its own one-shot scan.
  const interactive = opts.port !== 0
  const { config, configPath } = await resolveConfig(pkgDir)
  let state = await rebuild(pkgDir, config, configPath)
  // `let` so dev mode can re-read them when the chrome's CSS/tokens change.
  let vitrineCss = await readVitrineCss()
  let tokensCss = await readDesignTokens()
  const outdir = join(cacheDir(pkgDir), 'dist')

  // Live reload is the default for the interactive server (not just `--dev`): a
  // rebuild reloads the stage iframe and refetches the manifest. In `--dev`
  // (developing the chrome itself) the shell additionally does a full reload.
  const reload = interactive

  // Cases that threw under `renderToString` (browser-only). Once recorded, the
  // server skips the server-render attempt and serves an adopt-free document
  // that the client mounts. Cleared on rebuild so a fixed case recovers.
  const browserOnly = new Set<string>()

  // SSE fan-out: open streams (one per browser tab) that a rebuild pushes a
  // `reload` event to, and that completed a11y scans push an `a11y` event to.
  const encoder = new TextEncoder()
  const reloadClients = new Set<ReadableStreamDefaultController>()
  const broadcast = (chunk: Uint8Array) => {
    for (const c of reloadClients) {
      try {
        c.enqueue(chunk)
      } catch {
        reloadClients.delete(c)
      }
    }
  }
  // A rebuild reloads the open tabs, but how depends on *what* changed: a change
  // to the shell bundle itself (the chrome — its layout, the design-system
  // components it composes) needs a full page reload, while a change that only
  // affects rendered case/component content can reload just the stage iframe and
  // refetch the manifest, preserving nav state. The event payload tells the
  // client which; we detect a shell change by hashing the browser-entry bundle.
  const shellBundleHash = async (): Promise<string> => {
    const f = Bun.file(join(outdir, 'browser-entry.js'))
    return (await f.exists())
      ? Bun.hash(await f.arrayBuffer()).toString(16)
      : ''
  }
  let shellHash = await shellBundleHash()
  const triggerReload = (kind: 'shell' | 'content') =>
    broadcast(encoder.encode(`event: reload\ndata: ${kind}\n\n`))

  // On-demand a11y scanner (only when configured + interactive). Completed scans
  // are pushed to open browsers over the SSE stream so the panel updates in place.
  let scanner: A11yScanner | null = null

  // Latest known verdict per `${component}__${case}__${theme}`, recorded as
  // results flow through `onResult`. SSE only reaches tabs open at emit time, so
  // start-up population (and any earlier scan) would be invisible to a tab that
  // connects later; `/a11y/known` replays these so a fresh client seeds its nav.
  const lastA11y = new Map<
    string,
    {
      component: string
      case: string
      theme: 'light' | 'dark'
    } & A11yScanStatus
  >()

  // Port 0 (the headless check harness) means "let the OS pick" — leave it. Any
  // other port is preferred-not-mandatory, so two worktrees never collide.
  const port = opts.port === 0 ? 0 : await firstFreePort(opts.port ?? 3100)

  const server = Bun.serve({
    port,
    // The `/__livereload` SSE stream is long-lived; the default 10s idle timeout
    // would close it and churn reconnects. Disable it for the interactive server.
    // (0 = no timeout.) The check harness (non-interactive) keeps the default.
    idleTimeout: interactive ? 0 : 10,
    async fetch(req) {
      const url = new URL(req.url)
      const path = url.pathname

      if (path === '/health') return new Response('ok')

      if (interactive && path === '/__livereload') {
        let self: ReadableStreamDefaultController | null = null
        const stream = new ReadableStream({
          start(controller) {
            self = controller
            reloadClients.add(controller)
            controller.enqueue(encoder.encode(': connected\n\n'))
          },
          cancel() {
            if (self) reloadClients.delete(self)
          },
        })
        return new Response(stream, {
          headers: {
            'content-type': 'text/event-stream',
            'cache-control': 'no-cache',
            connection: 'keep-alive',
          },
        })
      }

      if (path === '/manifest.json') {
        return Response.json(state.manifest)
      }

      // Every verdict known so far (start-up population + completed scans), so a
      // client connecting after those SSE events still seeds its nav markers.
      if (scanner && path === '/a11y/known') {
        return Response.json([...lastA11y.values()])
      }

      // On-demand a11y for the viewed variant: cached → result, miss → enqueue a
      // scan and report `pending` (the result later arrives over the SSE stream).
      if (scanner && path === '/a11y') {
        const component = url.searchParams.get('component')
        const caseId = url.searchParams.get('case')
        const theme = url.searchParams.get('theme')
        if (!component || !caseId || (theme !== 'light' && theme !== 'dark')) {
          return new Response('bad request', { status: 400 })
        }
        const force = url.searchParams.get('rescan') === '1'
        return Response.json(
          await scanner.request(component, caseId, theme, force),
        )
      }

      if (path.startsWith('/dist/')) {
        const file = Bun.file(join(outdir, path.slice('/dist/'.length)))
        return (await file.exists())
          ? new Response(file)
          : new Response('not found', { status: 404 })
      }

      if (path.startsWith('/doc/')) {
        const id = path.slice('/doc/'.length)
        const docPath = state.placardById.get(id)
        if (!docPath) return new Response('no doc', { status: 404 })
        return new Response(Bun.file(docPath), {
          headers: { 'content-type': 'text/markdown; charset=utf-8' },
        })
      }

      // The Primer's chrome-free document lives under the reserved
      // `/render/primer` name — a sibling of the other `/render/*` snapshots,
      // not the SPA's `/primer` browse route (handled by the shell fallthrough
      // below). Matched before the generic `/render/*` so it's served as the
      // Primer, never mistaken for a component render of an id `primer`.
      if (path === '/render/primer') {
        const scanning = url.searchParams.has('dcscan')
        const theme =
          url.searchParams.get('theme') === 'dark' ? 'dark' : 'light'
        // Pre-render the primer (prose + live specimens) into the document so it
        // reads without scripting. A browser-only specimen makes the renderer
        // report `browserOnly`; the whole primer then falls back to client
        // rendering (delivered empty for the client to mount).
        let markup = ''
        let ssr = false
        let headStyles: string | undefined
        if (state.renderPrimer) {
          const result = state.renderPrimer()
          if (result.browserOnly) {
            console.warn(
              `  ⚠ primer can't render server-side (${result.error ?? 'threw'}); the client will render it`,
            )
          } else {
            markup = result.html
            ssr = true
            headStyles = result.headStyles
          }
        }
        return new Response(
          primerHtml(
            state.globalCss,
            tokensCss,
            vitrineCss,
            reload && !scanning,
            {
              theme,
              markup,
              ssr,
              headStyles,
            },
          ),
          {
            headers: { 'content-type': 'text/html; charset=utf-8' },
          },
        )
      }

      if (path === '/render' || path.startsWith('/render/')) {
        // The a11y scanner appends `?dcscan=1` and waits for network idle, which
        // an open live-reload SSE would never reach — so omit it for that fetch.
        const scanning = url.searchParams.has('dcscan')
        const rs = parseRenderState(url)
        const key = `${rs.componentId}/${rs.caseId}`
        // Pre-render the case to markup, baked into the document so it's present
        // before the page's scripts run. A browser-only case (or one already
        // recorded as such) is served adopt-free for the client to mount.
        if (rs.componentId && rs.caseId && !browserOnly.has(key)) {
          const result = state.renderCase({
            componentId: rs.componentId,
            caseId: rs.caseId,
            width: rs.width,
            tweaks: rs.tweaks,
          })
          if (result.browserOnly) {
            browserOnly.add(key)
            console.warn(
              `  ⚠ ${key} can't render server-side (${result.error ?? 'threw'}); the client will render it`,
            )
          } else {
            rs.markup = result.html
            rs.ssr = true
            rs.headStyles = result.headStyles
          }
        }
        return new Response(
          renderHtml(state.globalCss, vitrineCss, reload && !scanning, rs),
          {
            headers: { 'content-type': 'text/html; charset=utf-8' },
          },
        )
      }

      // Shell handles `/`, `/primer`, and all `/c/...` browse routes. The server
      // pre-renders the shell from the in-memory manifest + this request's route
      // so the landing surface and every deep link arrive painted; the client
      // adopts it. The shell does a full reload only in `--dev` (chrome may have
      // changed); the runtime config drives the non-dev iframe + manifest refresh.
      const theme: Theme =
        url.searchParams.get('theme') === 'dark' ? 'dark' : 'light'
      const a11y = scanner !== null
      const shell = renderShellToHtml({
        manifest: state.manifest,
        pathname: path,
        search: url.search,
        theme,
        a11y,
      })
      const seedScript = `<script>window.__dcSeed=${JSON.stringify({ manifest: state.manifest, theme, a11y })}</script>`
      return new Response(
        shellHtml(
          state.manifest.title,
          state.globalCss,
          vitrineCss,
          tokensCss,
          dev,
          interactive ? clientConfigScript({ reload, a11y, dev }) : '',
          { theme, markup: shell.html, ssr: shell.ssr, seedScript },
        ),
        {
          headers: { 'content-type': 'text/html; charset=utf-8' },
        },
      )
    },
  })

  // Build the on-demand scanner now that the server has a URL to scan against.
  if (interactive && config.a11y?.enabled) {
    const base = String(server.url).replace(/\/$/, '')
    scanner = createA11yScanner({
      pkgDir,
      config,
      baseUrl: () => base,
      caseFileAbs: (id) => {
        const c = state.manifest.components.find((x) => x.id === id)
        return c ? resolve(REPO_ROOT, c.caseFile) : null
      },
      onResult: (component, caseId, theme, status) => {
        // Remember the latest verdict so late-joining tabs can replay it, then
        // push it to the tabs already listening.
        lastA11y.set(`${component}__${caseId}__${theme}`, {
          component,
          case: caseId,
          theme,
          ...status,
        })
        broadcast(
          encoder.encode(
            `event: a11y\ndata: ${JSON.stringify({ component, case: caseId, theme, ...status })}\n\n`,
          ),
        )
      },
    })

    // Populate the nav at start-up per the configured mode (default 'off' — a
    // no-op). Detached: scanning must never delay the server becoming reachable,
    // and `refresh` work rides the scanner's own bounded queue.
    const startupMode = config.a11y?.startup ?? 'off'
    if (startupMode !== 'off') {
      const themes = config.a11y?.themes ?? ['light', 'dark']
      const variants = state.manifest.components.flatMap((c) =>
        c.cases.flatMap((cs) =>
          themes.map((theme) => ({
            componentId: c.id,
            caseId: cs.id,
            theme,
          })),
        ),
      )
      void scanner.populateAtStartup(variants, startupMode)
    }
  }

  // Debounced rebuild. Refreshes the manifest + bundle, drops the a11y cache's
  // in-flight bookkeeping (the on-disk hashes still decide what re-scans), and —
  // when reload is on — pushes a reload so the iframe + manifest refresh. In dev
  // it also re-reads the inlined chrome CSS/tokens (the shell full-reloads).
  let timer: ReturnType<typeof setTimeout> | null = null
  const scheduleRebuild = (label: string) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(async () => {
      try {
        console.log(`↻ ${label}, rebuilding…`)
        if (dev) {
          vitrineCss = await readVitrineCss()
          tokensCss = await readDesignTokens()
        }
        state = await rebuild(pkgDir, config, configPath)
        browserOnly.clear()
        scanner?.invalidateAll()
        // The module graph may have shifted (a new sibling import, or one
        // dropped) — reconcile the dependency watchers against it.
        await syncGraphWatchers()
        if (reload) {
          // Full-reload the tab when the chrome bundle changed; otherwise just
          // refresh the rendered content (iframe + manifest), keeping nav state.
          const nextHash = await shellBundleHash()
          const kind = nextHash !== shellHash ? 'shell' : 'content'
          shellHash = nextHash
          triggerReload(kind)
        }
      } catch (err) {
        console.error(err)
      }
    }, 150)
  }

  // Watch the consumer package's source. Any app-relevant source change rebuilds
  // — component implementations and styles, not just case/doc/primer files — so
  // editing a component hot-reloads its rendered case (and re-evaluates a11y).
  //
  // We watch via @parcel/watcher (native FSEvents / inotify / ReadDirectoryChangesW)
  // rather than node's `fs.watch`: recursive `fs.watch` on macOS drops events for
  // atomic/rename writes (most editor saves) and coalesces rapid changes, so an
  // edit would silently fail to rebuild and the open page would serve stale code.
  // @parcel/watcher delivers reliable, absolute-path events across platforms.
  const srcDir = join(pkgDir, 'src')
  const watchSrc = interactive && existsSync(srcDir)
  const watchHere = dev && resolve(srcDir) !== resolve(HERE)
  // Load the native watcher only on the paths that actually watch — `check` and
  // the per-rebuild `--print-manifest` subprocess import this module too, and
  // shouldn't pay to dlopen the binding. Interactive servers always watch (the
  // target src plus the bundle's dependency graph; see syncGraphWatchers).
  const { subscribe } =
    watchSrc || watchHere || interactive
      ? await import('@parcel/watcher')
      : { subscribe: undefined }
  const watched = /\.(tsx?|css|mdx)$|\.placard\.md$/
  const ignore = ['node_modules', '.git', '.display-case', 'dist']
  if (subscribe && watchSrc) {
    await subscribe(
      srcDir,
      (err, events) => {
        if (err) return
        if (events.some((e) => watched.test(e.path)))
          scheduleRebuild('change detected')
      },
      { ignore },
    )
  }

  // Dev, showcasing a *different* package: also watch Display Case's own UI
  // source so editing the chrome hot-reloads even when `pkgDir` is elsewhere.
  if (subscribe && watchHere) {
    await subscribe(
      HERE,
      (err, events) => {
        if (err) return
        if (events.some((e) => /\.(tsx?|css)$/.test(e.path)))
          scheduleRebuild('app source changed')
      },
      { ignore },
    )
  }

  // Active dependency-graph subscriptions, keyed by watched dir, reconciled
  // against the current build's graph after each rebuild. The watch set is
  // derived from the bundle's real module graph (see graphWatchDirs) — this is
  // what picks up a workspace sibling resolved to source, so editing it rebuilds
  // instead of silently serving stale code.
  const graphWatchers = new Map<string, { unsubscribe(): Promise<void> }>()
  // The target's own workspace root — bounds the dependency watch. `REPO_ROOT`
  // tracks where Display Case itself lives (used for manifest-relative paths),
  // which is a different repo entirely when the tool is installed as a dep.
  const watchRoot = findWatchRoot(pkgDir)
  const syncGraphWatchers = async (): Promise<void> => {
    if (!subscribe || !interactive) return
    const want = graphWatchDirs(state.inputs, {
      srcDir,
      hereDir: HERE,
      repoRoot: watchRoot,
    })
    for (const dir of want) {
      if (graphWatchers.has(dir)) continue
      const sub = await subscribe(
        dir,
        (err, events) => {
          if (err) return
          if (events.some((e) => watched.test(e.path)))
            scheduleRebuild('dependency change detected')
        },
        { ignore },
      )
      graphWatchers.set(dir, sub)
    }
    for (const [dir, sub] of graphWatchers) {
      if (!want.has(dir)) {
        await sub.unsubscribe()
        graphWatchers.delete(dir)
      }
    }
  }

  // Initialize the dependency watchers from the first build's graph, then keep
  // them reconciled after every rebuild (the call in scheduleRebuild).
  await syncGraphWatchers()

  return server
}

/**
 * Build the manifest once and return it (used by `--print-manifest`, and by the
 * dev server's per-rebuild subprocess). Load errors are written to stderr so the
 * JSON stays the sole thing on stdout; a spawning parent can relay them.
 */
export async function getManifest(pkgDir: string): Promise<Manifest> {
  const { config } = await resolveConfig(pkgDir)
  const files = await discoverCaseFiles(pkgDir, config)
  const { modules, errors } = await loadModules(files)
  for (const e of errors) console.error(`  ✗ ${relPath(e.file)}: ${e.error}`)
  const hasPrimer = primerFile(pkgDir, config) !== null
  return buildManifest(pkgDir, modules, config, hasPrimer).manifest
}

export { slugify }
