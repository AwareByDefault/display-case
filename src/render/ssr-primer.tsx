import type { ReactNode } from 'react'
import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import { PrimerRoot } from '../ui/primer'

/**
 * Server-side primer rendering — the sibling of {@link makeCaseRenderer} for
 * the `/render/primer` document. The codegen'd SSR-primer entry imports the
 * compiled MDX and binds it here; the server imports that freshly-built bundle
 * each rebuild (same staleness reasoning as the case renderer). The primer's
 * prose and its embedded specimens render to markup once — the theme is a
 * document attribute, not part of the tree, so one render serves both themes.
 */

type MDXContent = (props: { components?: unknown }) => ReactNode

export interface PrimerHtmlResult {
  html: string
  /** True when the primer could not be rendered outside a browser (a specimen
   *  touched a browser-only API under `renderToString`). The whole primer then
   *  falls back to client rendering — the same isolation a single case gets. */
  browserOnly: boolean
  error?: string
}

export function makePrimerRenderer(
  Content: MDXContent,
): () => PrimerHtmlResult {
  return function renderPrimerToHtml(): PrimerHtmlResult {
    try {
      const html = renderToString(
        <StrictMode>
          <PrimerRoot content={Content} />
        </StrictMode>,
      )
      return { html, browserOnly: false }
    } catch (err) {
      return {
        html: '',
        browserOnly: true,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }
}
