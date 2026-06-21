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

/** Content-hashed entry URLs the production build emitted (already base-prefixed). */
export interface DocAssets {
  browser: string
  render: string
  primer: string
}

/** The browse shell document: pre-rendered chrome + inlined seed, hydrated by the
 *  browser entry. No dev injects. */
export function shellDoc(opts: {
  title: string
  tokensCss: string
  globalCss: string
  chromeCss: string
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
  return `<!doctype html><html lang="en" data-theme="${opts.theme}"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${opts.title}</title>${FONT_LINKS}<style>${opts.tokensCss}\n${opts.globalCss}\n${reset}\n${opts.chromeCss}</style></head><body><div id="root" data-ssr="${opts.ssr ? '1' : '0'}">${opts.markup}</div><script>window.__dcSeed=${seed}</script><script type="module" src="${opts.assets.browser}"></script></body></html>`
}

/** The isolated case render document. */
export function renderDoc(opts: {
  globalCss: string
  theme: Theme
  transparent: boolean
  fit: boolean
  markup: string
  ssr: boolean
  assets: DocAssets
}): string {
  const exhibitCenter =
    'body[data-decorated] #root>*{justify-content:center;align-content:center}'
  const bodyAttrs = opts.transparent
    ? ' data-decorated style="background:transparent"'
    : ''
  const rootAttrs = `${opts.fit ? ' style="width:fit-content"' : ''} data-ssr="${opts.ssr ? '1' : '0'}"`
  return `<!doctype html><html lang="en" data-theme="${opts.theme}" data-theme-pref="${opts.theme}"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Display Case render</title><style>html,body{margin:0}body{background:var(--color-bg);color:var(--color-fg);font-family:var(--font-sans, ui-sans-serif, system-ui, sans-serif)}${exhibitCenter}${opts.globalCss}</style></head><body${bodyAttrs}><main id="root"${rootAttrs}>${opts.markup}</main><script type="module" src="${opts.assets.render}"></script></body></html>`
}

/** The primer reading-page document. */
export function primerDoc(opts: {
  tokensCss: string
  globalCss: string
  theme: Theme
  markup: string
  ssr: boolean
  assets: DocAssets
}): string {
  const reset = 'html,body{margin:0;height:100%;background:var(--dc-bg)}'
  return `<!doctype html><html lang="en" data-theme="${opts.theme}" data-theme-pref="${opts.theme}"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Primer</title>${FONT_LINKS}<style>${opts.tokensCss}\n${opts.globalCss}\n${reset}</style></head><body><main id="root" data-ssr="${opts.ssr ? '1' : '0'}">${opts.markup}</main><script type="module" src="${opts.assets.primer}"></script></body></html>`
}
