import { renderToString } from 'react-dom/server'
import { findCase } from '../core/catalog'
import type { CaseModule, DisplayCaseConfig } from '../index'
import { type CaseTreeState, caseTree, NOOP_GOTO } from './render-node'

/**
 * Server-side case rendering. The codegen'd SSR entry (see
 * `codegenSsrEntry`) imports every discovered case module plus the consumer
 * config, hands them here, and exports the resulting `renderCaseToHtml`. The
 * server imports that freshly-built bundle each rebuild — the bundle inlines the
 * case source from disk, so its modules are always current, sidestepping the
 * per-path module cache that forces the manifest into a subprocess.
 */

export interface CaseHtmlResult {
  /** Pre-rendered `#root` inner markup, or `''` when the case is browser-only. */
  html: string
  /** True when the case could not be rendered outside a browser (it threw under
   *  `renderToString`, or no such case exists to even attempt). */
  browserOnly: boolean
  /** The throw's message, for the server to log once per browser-only case. */
  error?: string
}

export type CaseRenderer = (state: CaseTreeState) => CaseHtmlResult

export function makeCaseRenderer(
  modules: CaseModule[],
  config: DisplayCaseConfig,
): CaseRenderer {
  return function renderCaseToHtml(state: CaseTreeState): CaseHtmlResult {
    // A component declared `browserOnly` opts out of server rendering: skip the
    // attempt (no throw, no log) and let the client mount it.
    const found = findCase(modules, state.componentId, state.caseId)
    if (found?.module.browserOnly) return { html: '', browserOnly: true }
    try {
      const html = renderToString(caseTree(modules, config, state, NOOP_GOTO))
      return { html, browserOnly: false }
    } catch (err) {
      // The case — or a component it renders — needs a browser: it touched a
      // browser-only API (window, layout measurement, canvas…) under
      // `renderToString`. Don't fail the document; emit no server markup for
      // this case and let the client mount it. The server records it so later
      // requests skip the server attempt and so the author gets one log line.
      return {
        html: '',
        browserOnly: true,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }
}
