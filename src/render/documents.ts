import type { Manifest } from '../core/manifest'
import type { ThemeSignal } from '../index'
import type { Theme } from '../ui/shell-core'
import {
  resolveThemeSignals,
  themeRootAttrs,
  themeSignalsSeedScript,
} from './theme-signals'

/**
 * Production HTML document templates for a published build. They mirror the dev
 * server's documents but drop every development-only inject — no live-reload SSE
 * client, no `process/Bun is not defined` error overlay — and reference the
 * content-hashed asset URLs the production bundle emits (so a host can cache them
 * indefinitely). The React trees themselves are produced by the *shared*
 * renderers (`ssr-shell`, `ssr-render`, `ssr-primer`); only the envelope here
 * differs from dev, by necessity (hashed assets vs. a fixed dev path).
 */

const FONT_LINKS =
  '<link rel="preconnect" href="https://fonts.googleapis.com"/>' +
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>' +
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"/>'

/** Content-hashed entry URLs the production build emitted (already base-prefixed).
 *  `render` is a per-component map (componentId → bundle URL): each component is
 *  built into its own bundle so the catalog is never built as one graph. */
export interface DocAssets {
  browser: string
  render: Record<string, string>
  primer: string
  /** Resolves each externalized bare specifier (the shared runtime libraries) to
   *  its one content-hashed vendor bundle — the `<script type="importmap">` body's
   *  `imports`. Empty when nothing is shared (e.g. the dev preview). */
  importmap: Record<string, string>
}

/**
 * The importmap that resolves every bare specifier left external in the chrome and
 * per-component bundles — the shared runtime libraries (React always, plus any the
 * author declared to `share`) — to its one shared vendor bundle, so the browser
 * downloads each shared library once across the whole showcase instead of a copy
 * per bundle. Emitted in `<head>`, before any module script. Empty when nothing is
 * shared (no vendor bundles, e.g. the dev preview), so the documents stay valid.
 * Works under a plain static host too (it's just markup).
 */
export function importMap(imports: Record<string, string>): string {
  if (!imports || Object.keys(imports).length === 0) return ''
  return `<script type="importmap">${JSON.stringify({ imports })}</script>`
}

/** The browse shell document: pre-rendered chrome + inlined seed, hydrated by the
 *  browser entry. No dev injects. */
export function shellDoc(opts: {
  title: string
  tokensCss: string
  globalCss: string
  vitrineCss: string
  theme: Theme
  /** The effective theme root signals to emit (see the `theme` config). */
  signals: readonly ThemeSignal[]
  markup: string
  ssr: boolean
  manifest: Manifest
  a11y: boolean
  assets: DocAssets
}): string {
  // `color-scheme` matches the theme so user-agent surfaces (scrollbars, default
  // control chrome) follow it rather than rendering in their light defaults.
  const reset = `html,body{margin:0;height:100%;background:var(--dc-bg)}html{color-scheme:${opts.theme}}`
  const rootAttrs = themeRootAttrs(
    resolveThemeSignals(opts.theme, opts.signals),
  )
  const seed = JSON.stringify({
    manifest: opts.manifest,
    theme: opts.theme,
    a11y: opts.a11y,
  })
  return `<!doctype html><html lang="en"${rootAttrs}><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${opts.title}</title>${FONT_LINKS}<style>${opts.tokensCss}\n${opts.globalCss}\n${reset}\n${opts.vitrineCss}</style>${importMap(opts.assets.importmap)}</head><body><div id="root" data-ssr="${opts.ssr ? '1' : '0'}">${opts.markup}</div><script>window.__dcSeed=${seed}</script>${themeSignalsSeedScript(opts.signals)}<script type="module" src="${opts.assets.browser}"></script></body></html>`
}

// The isolated case render document used to live here, alongside the shell and
// primer documents. It now belongs to the DOM substrate (`substrate/dom.ts`):
// the document envelope is where a medium's assumptions live — the theme signals
// on the root, the body surface, the mount, the script tag — so it is the
// substrate's to shape, and both the dev server and this production host render
// it through `substrate.document()`. The shell and primer documents below stay:
// they are the browse *chrome*, which remains a DOM application by design.

/** The primer reading-page document. */
export function primerDoc(opts: {
  tokensCss: string
  globalCss: string
  vitrineCss: string
  theme: Theme
  /** The effective theme root signals to emit (see the `theme` config). */
  signals: readonly ThemeSignal[]
  markup: string
  ssr: boolean
  /** Style-engine output, placed after the static <style> block. `''` when none. */
  headStyles?: string
  assets: DocAssets
}): string {
  // `color-scheme` matches the theme so user-agent surfaces (scrollbars, default
  // control chrome) follow it rather than rendering in their light defaults.
  const reset = `html,body{margin:0;height:100%;background:var(--dc-bg)}html{color-scheme:${opts.theme}}`
  const rootAttrs = themeRootAttrs(
    resolveThemeSignals(opts.theme, opts.signals),
  )
  return `<!doctype html><html lang="en"${rootAttrs}><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Primer</title>${FONT_LINKS}<style>${opts.tokensCss}\n${opts.globalCss}\n${reset}\n${opts.vitrineCss}</style>${opts.headStyles ?? ''}${importMap(opts.assets.importmap)}</head><body><main id="root" data-ssr="${opts.ssr ? '1' : '0'}">${opts.markup}</main>${themeSignalsSeedScript(opts.signals)}<script type="module" src="${opts.assets.primer}"></script></body></html>`
}
