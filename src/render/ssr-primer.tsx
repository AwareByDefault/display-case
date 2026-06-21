import type { ReactNode } from 'react'
import { StrictMode } from 'react'
import type { DisplayCaseConfig } from '../index'
import { PrimerRoot } from '../ui/primer'
import { renderWithStyles } from './collect-styles'

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
  /** Render-time (CSS-in-JS) styling collected by the configured style engines,
   *  as `<head>` markup. `''` (or absent) when no engine produced styling. */
  headStyles?: string
}

export function makePrimerRenderer(
  Content: MDXContent,
  config: DisplayCaseConfig,
): () => PrimerHtmlResult {
  return function renderPrimerToHtml(): PrimerHtmlResult {
    try {
      // Apply any configured style engines around the primer tree, exactly as the
      // case renderer does, so a specimen's render-time CSS-in-JS styling is
      // delivered before scripting too.
      const { html, headStyles } = renderWithStyles(
        <StrictMode>
          <PrimerRoot content={Content} />
        </StrictMode>,
        config.styleEngines,
      )
      return { html, browserOnly: false, headStyles }
    } catch (err) {
      return {
        html: '',
        browserOnly: true,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }
}
