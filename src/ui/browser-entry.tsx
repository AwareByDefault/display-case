import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { Shell } from './shell'
import { parseRoute } from './shell-core'
import type { ShellSeed } from './use-shell'

// Entry for the browse chrome. The server pre-renders the shell into #root and
// inlines the seed it rendered from (`window.__dcSeed`: the manifest, theme,
// and a11y flag). The route comes from the live address — which equals the
// request path the server rendered — so server and client derive the same route
// and the seeded initial state matches. The client then adopts (hydrates) the
// markup; case modules are still bundled only into the render entry, never here.
const inlined = (
  globalThis as {
    __dcSeed?: {
      manifest: ShellSeed['manifest']
      theme: ShellSeed['theme']
      a11y: boolean
    }
  }
).__dcSeed

const rootEl = document.getElementById('root') as HTMLElement
if (!inlined) throw new Error('Display Case: missing shell seed (__dcSeed)')

const seed: ShellSeed = {
  manifest: inlined.manifest,
  route: parseRoute(window.location.pathname, window.location.search),
  theme: inlined.theme,
  a11y: inlined.a11y,
}

const tree = (
  <StrictMode>
    <Shell seed={seed} />
  </StrictMode>
)

// Adopt the server-rendered shell when present (`data-ssr="1"`); mount fresh
// otherwise.
if (rootEl.dataset.ssr === '1') {
  hydrateRoot(rootEl, tree, {
    onRecoverableError: (err) =>
      console.warn(
        '[display-case] shell adopt mismatch; client re-rendered:',
        err,
      ),
  })
} else {
  createRoot(rootEl).render(tree)
}
