import type { ReactNode } from 'react'
import { findCase } from '../core/catalog'
import type { Substrate, SubstrateRenderContext } from '../core/substrate'
import type { CaseModule, DisplayCaseConfig } from '../index'
import { type CaseTreeState, caseTree, NOOP_GOTO } from './render-node'

/**
 * Server-side case rendering. The codegen'd per-component SSR entry (see
 * `codegenCaseSsrEntry`) imports one component's case module plus the consumer
 * config, hands it here, and exports the resulting `renderCaseToHtml`. The server
 * builds and imports that bundle on demand per component — the bundle inlines the
 * case source from disk, so its modules are always current, sidestepping the
 * per-path module cache that forces the manifest into a subprocess.
 *
 * This module is the bridge between the substrate-neutral case tree and the
 * configured substrate: it builds the tree with `caseTree()` (DOM-free) and
 * hands it to `substrate.render()`. The substrate is passed *in* rather than
 * resolved here, so this layer keeps pointing inward (render → core → index)
 * and never depends on a substrate implementation; the codegen'd entry, which
 * already imports the consumer config, resolves it and wires it through.
 */

/** The opaque frame a substrate produced, plus what the host needs to know
 *  about it without inspecting it. */
export interface CaseRenderResult {
  /** The substrate's frame, handed back to `serialize()`/`document()` verbatim. */
  frame: unknown
  /** True when the case could not be rendered headlessly and the stage runtime
   *  must paint it instead. */
  browserOnly: boolean
  /** The throw's message, for the server to log once per such case. */
  error?: string
}

export type CaseRenderer = (
  state: CaseTreeState,
  /** Render-kind variant values (the DOM substrate reads `theme`) and the
   *  substrate-defined address options. Defaulted when omitted. */
  variants?: Record<string, string>,
  params?: Record<string, string>,
) => Promise<CaseRenderResult>

export function makeCaseRenderer(
  modules: CaseModule[],
  config: DisplayCaseConfig,
  substrate: Substrate,
): CaseRenderer {
  // Fill each render-kind axis from its declared default, so a caller that
  // names no variant still gets a complete, deterministic context.
  const axisDefaults: Record<string, string> = {}
  for (const axis of substrate.variants) {
    if (axis.kind === 'render') axisDefaults[axis.id] = axis.default
  }

  return async function renderCaseToHtml(
    state: CaseTreeState,
    variants: Record<string, string> = {},
    params: Record<string, string> = {},
  ): Promise<CaseRenderResult> {
    const found = findCase(modules, state.componentId, state.caseId)
    const ctx: SubstrateRenderContext = {
      componentId: state.componentId,
      caseId: state.caseId,
      tweaks: state.tweaks,
      variants: { ...axisDefaults, ...variants },
      params,
      // A component declared `browserOnly` opts out of headless rendering; the
      // substrate returns an empty frame rather than attempting it.
      clientOnly: found?.module.browserOnly === true,
      config,
    }

    // A client-only case is skipped *before* the tree is built, not merely
    // before it is rendered. Building the tree calls the case's own thunk, and
    // a case declared browser-only may touch `window`/`document` right there —
    // reading the theme off the document to pick a provider mode, say. Ask the
    // substrate for its empty frame and let the stage runtime paint it.
    if (ctx.clientOnly) {
      return { frame: await substrate.render(null, ctx), browserOnly: true }
    }

    let tree: ReactNode
    try {
      tree = caseTree(modules, config, state, NOOP_GOTO)
    } catch (err) {
      // The case needs a browser to even construct its tree. Same fallback as a
      // throw during the render itself: no headless frame, the stage paints it,
      // and the host logs the reason once.
      return {
        frame: await substrate.render(null, { ...ctx, clientOnly: true }),
        browserOnly: true,
        error: err instanceof Error ? err.message : String(err),
      }
    }

    const frame = await substrate.render(tree, ctx)
    // `browserOnly` is the one thing the host reads back, and it is not read off
    // the frame (which stays opaque): the DOM substrate reports it on its own
    // frame type, so narrow structurally rather than assuming a shape.
    const reported = frame as { browserOnly?: boolean; error?: string }
    return {
      frame,
      browserOnly: reported?.browserOnly === true,
      error: reported?.error,
    }
  }
}
