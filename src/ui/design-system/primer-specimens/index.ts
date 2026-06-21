/**
 * Primer specimens — Display Case's own document-specific specimens for its
 * Primer wall text (colour ramps, type scale, spacing, brand, states, render
 * address). These are thin wrappers: each supplies Display-Case-specific data to
 * a reusable primitive under `components/primer-specimen/` (or, for the live
 * states/flow/tweaks demos, composes the design-system components directly).
 *
 * They live outside `components/` so they aren't subject to the showcase
 * coverage lint, and they're imported only by `primer.mdx`. Anyone building
 * their own Primer should import the generic primitives from
 * `components/primer-specimen` and feed them their own data — these wrappers
 * are the worked example.
 */

export { Glyphs } from './brand'
export { MarigoldRamp, PaperRamp, SemanticSwatches, StatusHues } from './colors'
export {
  ControlsOverview,
  PrimerOverview,
  ShowcaseOverview,
} from './components'
export { DefList, LayoutMock, StatesRow } from './foundations'
export { FlowNavDemo, RenderAddress, TweaksPanelDemo } from './showcase'
export { ElevationRow, RadiusRow, SpacingScale } from './spacing'
export { FontFamilies, TypeScale, Weights } from './type'
