import type { Manifest } from '../core/manifest'
import type { Theme } from '../ui/shell-core'

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
  /** The shared React bundle every browser entry imports via the importmap. */
  vendor: string
}

/**
 * The importmap that resolves the bare React specifiers — left external in the
 * chrome and per-component bundles — to the one shared `vendor` bundle, so the
 * browser downloads React once across the whole showcase instead of a copy per
 * bundle. Emitted in `<head>`, before any module script. Empty when no vendor URL
 * (older builds), so the documents stay valid. Works under a plain static host
 * too (it's just markup).
 */
function importMap(vendor: string): string {
  if (!vendor) return ''
  const map = {
    imports: {
      react: vendor,
      'react-dom': vendor,
      'react-dom/client': vendor,
      'react/jsx-runtime': vendor,
    },
  }
  return `<script type="importmap">${JSON.stringify(map)}</script>`
}

/** The browse shell document: pre-rendered chrome + inlined seed, hydrated by the
 *  browser entry. No dev injects. */
export function shellDoc(opts: {
  title: string
  tokensCss: string
  globalCss: string
  vitrineCss: string
  theme: Theme
  markup: string
  ssr: boolean
  manifest: Manifest
  a11y: boolean
  assets: DocAssets
}): string {
  const reset = 'html,body{margin:0;height:100%;background:var(--dc-bg)}'
  const seed = JSON.stringify({
    manifest: opts.manifest,
    theme: opts.theme,
    a11y: opts.a11y,
  })
  return `<!doctype html><html lang="en" data-theme="${opts.theme}"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${opts.title}</title>${FONT_LINKS}<style>${opts.tokensCss}\n${opts.globalCss}\n${reset}\n${opts.vitrineCss}</style>${importMap(opts.assets.vendor)}</head><body><div id="root" data-ssr="${opts.ssr ? '1' : '0'}">${opts.markup}</div><script>window.__dcSeed=${seed}</script><script type="module" src="${opts.assets.browser}"></script></body></html>`
}

/** The isolated case render document. `scriptSrc` is this component's own bundle
 *  URL (the catalog is split per component, so there is no single render entry). */
export function renderDoc(opts: {
  globalCss: string
  vitrineCss: string
  theme: Theme
  transparent: boolean
  fit: boolean
  markup: string
  ssr: boolean
  /** Style-engine output, placed after the static <style> block. `''` when none. */
  headStyles?: string
  scriptSrc: string
  /** The shared React vendor bundle URL (for the importmap). */
  vendor: string
}): string {
  const exhibitCenter =
    'body[data-decorated] #root>*{justify-content:center;align-content:center}'
  const bodyAttrs = opts.transparent
    ? ' data-decorated style="background:transparent"'
    : ''
  const rootAttrs = `${opts.fit ? ' style="width:fit-content"' : ''} data-ssr="${opts.ssr ? '1' : '0'}"`
  // The Vitrine stylesheet follows globalCss so a dogfooded design-system case
  // paints before scripts; for a non-dogfooding consumer these are inert chrome
  // rules in a dev-time-only preview document (see server.ts renderHtml).
  return `<!doctype html><html lang="en" data-theme="${opts.theme}" data-theme-pref="${opts.theme}"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Display Case render</title><style>html,body{margin:0}body{background:var(--color-bg);color:var(--color-fg);font-family:var(--font-sans, ui-sans-serif, system-ui, sans-serif)}${exhibitCenter}${opts.globalCss}\n${opts.vitrineCss}</style>${opts.headStyles ?? ''}${importMap(opts.vendor)}</head><body${bodyAttrs}><main id="root"${rootAttrs}>${opts.markup}</main><script type="module" src="${opts.scriptSrc}"></script></body></html>`
}

/** The primer reading-page document. */
export function primerDoc(opts: {
  tokensCss: string
  globalCss: string
  vitrineCss: string
  theme: Theme
  markup: string
  ssr: boolean
  /** Style-engine output, placed after the static <style> block. `''` when none. */
  headStyles?: string
  assets: DocAssets
}): string {
  const reset = 'html,body{margin:0;height:100%;background:var(--dc-bg)}'
  return `<!doctype html><html lang="en" data-theme="${opts.theme}" data-theme-pref="${opts.theme}"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Primer</title>${FONT_LINKS}<style>${opts.tokensCss}\n${opts.globalCss}\n${reset}\n${opts.vitrineCss}</style>${opts.headStyles ?? ''}${importMap(opts.assets.vendor)}</head><body><main id="root" data-ssr="${opts.ssr ? '1' : '0'}">${opts.markup}</main><script type="module" src="${opts.assets.primer}"></script></body></html>`
}
