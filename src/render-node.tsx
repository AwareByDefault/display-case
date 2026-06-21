import type { ReactNode } from 'react'
import { StrictMode } from 'react'
import { findCase, slugify } from './catalog'
import type {
  CaseModule,
  DisplayCaseConfig,
  FlowStep,
  GotoFn,
  TweakedCase,
  TweakSchema,
  TweakValues,
} from './index'

/**
 * The pure, DOM-free construction of a single case's React tree. Both the
 * server (pre-rendering the isolated `/render` document to markup) and the
 * client (hydrating, then driving in-place swaps/tweaks) build the tree through
 * this one function, so the two can never disagree on markup — the prerequisite
 * for hydration without mismatch. It touches no `window`/`document`: the
 * document-level effects of a render (the theme on `<html>`, the body
 * background, the mount width) are applied by the caller, not here.
 */

/** The slice of render state the React tree depends on (no theme/fit/transparent —
 *  those are document-level, applied outside the tree). */
export interface CaseTreeState {
  componentId: string
  caseId: string
  width: number | null
  tweaks: Record<string, string>
}

/** Decode the string tweak map (from the address) into typed render values. */
export function resolveTweaks(
  schema: TweakSchema,
  tweaks: Record<string, string>,
): TweakValues<TweakSchema> {
  const values: Record<string, string | number | boolean> = {}
  for (const [key, desc] of Object.entries(schema)) {
    const raw = tweaks[key]
    if (raw === undefined) {
      values[key] = desc.default
      continue
    }
    switch (desc.kind) {
      case 'boolean':
        values[key] = raw === '1' || raw === 'true'
        break
      case 'number':
        values[key] = Number(raw)
        break
      default:
        values[key] = raw
    }
  }
  return values as TweakValues<TweakSchema>
}

/** Encode a step's `goto` overrides into the string tweak map used in URLs. */
export function encodeOverrides(
  overrides?: Record<string, string | number | boolean>,
): Record<string, string> {
  const out: Record<string, string> = {}
  if (!overrides) return out
  for (const [k, v] of Object.entries(overrides)) {
    if (typeof v === 'boolean') out[k] = v ? '1' : '0'
    else out[k] = String(v)
  }
  return out
}

/** A `goto` that does nothing — used when pre-rendering on the server, where a
 *  flow step's initial paint is rendered but no interaction can occur. */
export const NOOP_GOTO: GotoFn = () => {}

/**
 * Build the full React tree for a case: the case's node (simple thunk, tweaked
 * render, or flow step), optionally width-constrained, wrapped in the configured
 * decorator and `StrictMode`. A missing case yields the not-found node verbatim
 * (no `StrictMode` wrapper), matching what the catalog reports. `goto` is wired
 * into flow steps; pass {@link NOOP_GOTO} on the server.
 */
export function caseTree(
  modules: CaseModule[],
  config: DisplayCaseConfig,
  state: CaseTreeState,
  goto: GotoFn,
): ReactNode {
  const found = findCase(modules, state.componentId, state.caseId)
  if (!found) {
    return (
      <div className="dc-render-missing">
        No such case: {state.componentId}/{state.caseId}
      </div>
    )
  }

  let node: ReactNode
  if (typeof found.case === 'function') {
    node = found.case()
  } else if (found.module.isFlow) {
    const step = found.case as FlowStep
    const values = resolveTweaks(step.tweaks ?? {}, state.tweaks)
    node = step.render({ values, goto })
  } else {
    const tweaked = found.case as TweakedCase
    node = tweaked.render(resolveTweaks(tweaked.tweaks, state.tweaks))
  }

  const wrapped = state.width ? (
    <div style={{ maxWidth: `${state.width}px`, margin: '0 auto' }}>{node}</div>
  ) : (
    node
  )

  const Decorator = config.decorator
  return (
    <StrictMode>
      {Decorator ? (
        <Decorator
          level={found.module.level}
          sourcePath={found.module.sourcePath}
          area={found.module.area}>
          {wrapped}
        </Decorator>
      ) : (
        wrapped
      )}
    </StrictMode>
  )
}

export { slugify }
