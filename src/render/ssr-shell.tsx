import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import type { Manifest } from '../core/manifest'
import { Shell } from '../ui/shell'
import { parseRoute, type Theme } from '../ui/shell-core'
import type { ShellSeed } from '../ui/use-shell'

/**
 * Server-side render of the browse shell. Unlike the case/primer renderers, the
 * shell depends only on the manifest *data* and the request route — not on any
 * consumer case module — so it renders in-process from the in-memory manifest
 * with no per-rebuild bundle. The same `<Shell seed=…>` the client hydrates is
 * rendered here, seeded from the request, so the two agree.
 */

export interface ShellHtmlResult {
  /** Pre-rendered `#root` inner markup, or `''` when the shell could not render. */
  html: string
  /** Whether `html` is present, so the client adopts instead of mounting fresh. */
  ssr: boolean
}

export function renderShellToHtml(args: {
  manifest: Manifest
  pathname: string
  search: string
  theme: Theme
  a11y: boolean
}): ShellHtmlResult {
  const route = parseRoute(args.pathname, args.search)
  const seed: ShellSeed = {
    manifest: args.manifest,
    route,
    theme: args.theme,
    a11y: args.a11y,
  }
  try {
    const html = renderToString(
      <StrictMode>
        <Shell seed={seed} />
      </StrictMode>,
    )
    return { html, ssr: true }
  } catch (err) {
    // The shell is first-party code; a throw here is a defect, not a graceful
    // case. Don't fail the document — serve it empty for the client to mount,
    // and surface the error so it gets fixed.
    console.warn(
      '[display-case] shell server-render failed; the client will render it:',
      err instanceof Error ? err.message : String(err),
    )
    return { html: '', ssr: false }
  }
}
