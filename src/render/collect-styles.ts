import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import type { StyleEngine } from '../index'

/**
 * Render a tree to markup, applying any configured style engines so render-time
 * (CSS-in-JS) styling is collected and delivered before scripting.
 *
 * Each engine is a factory invoked **once per render** (see {@link StyleEngine}),
 * giving every render an isolated style store — one case's styling can never leak
 * into another's document. Engines wrap the tree in array order (the first is
 * outermost); after `renderToString`, each collector's `collect(html)` output is
 * concatenated into a single `headStyles` string for the document `<head>`.
 *
 * With no engines configured, the tree is rendered unwrapped and `headStyles` is
 * `''`, so the resulting document is byte-identical to its engine-free form.
 */
export function renderWithStyles(
  tree: ReactNode,
  engines: StyleEngine[] | undefined,
): { html: string; headStyles: string } {
  const collectors = (engines ?? []).map((make) => make())
  let wrapped = tree
  // Apply from last to first so the first engine ends up outermost.
  for (let i = collectors.length - 1; i >= 0; i--) {
    wrapped = collectors[i].wrap(wrapped)
  }
  const html = renderToString(wrapped)
  const headStyles = collectors
    .map((collector) => collector.collect(html))
    .join('')
  return { html, headStyles }
}
