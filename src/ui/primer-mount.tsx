import type { ReactNode } from 'react'
import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { PrimerRoot } from './primer'

/**
 * Entry point for the isolated `/render/primer` document. Mounts the compiled MDX
 * primer into #root and sets the initial theme from the URL (`?theme=`); later
 * theme changes arrive over `postMessage` (handled in {@link PrimerRoot}).
 *
 * Driven two ways, mirroring the `/render` frame:
 *  - **Standalone** (direct navigation / snapshot): theme comes from the URL.
 *  - **Embedded** (browse chrome iframe): the chrome pushes theme + scroll
 *    messages and reads back the section list + active section.
 */
type MDXContent = (props: { components?: unknown }) => ReactNode

/**
 * Neutralize anchor clicks that would unload the primer frame. Authored prose
 * can contain real `<a href>` links; in this isolated frame a click would do a
 * full-document navigation and sever the chrome↔frame handshake. In-page hash
 * links and `target=_blank` are harmless and left alone.
 */
function blockFrameNavigation(): void {
  document.addEventListener(
    'click',
    (e) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return
      }
      const anchor = (e.target as HTMLElement | null)?.closest?.('a')
      const href = anchor?.getAttribute('href')
      if (!anchor || !href) return
      if (anchor.target && anchor.target !== '_self') return
      const url = new URL(href, window.location.href)
      if (url.pathname === window.location.pathname && url.hash !== '') return
      e.preventDefault()
    },
    true,
  )
}

export function mountPrimer(Content: MDXContent): void {
  blockFrameNavigation()
  const params = new URLSearchParams(window.location.search)
  const theme = params.get('theme') === 'dark' ? 'dark' : 'light'
  document.documentElement.dataset.theme = theme
  document.documentElement.dataset.themePref = theme

  const rootEl = document.getElementById('root') as HTMLElement
  const tree = (
    <StrictMode>
      <PrimerRoot content={Content} />
    </StrictMode>
  )
  // Adopt the server-rendered primer when present (`data-ssr="1"`); otherwise
  // mount fresh (a browser-only specimen forced a client-render fallback).
  if (rootEl.dataset.ssr === '1') {
    hydrateRoot(rootEl, tree, {
      onRecoverableError: (err) =>
        console.warn(
          '[display-case] primer adopt mismatch; client re-rendered:',
          err,
        ),
    })
  } else {
    createRoot(rootEl).render(tree)
  }
}
