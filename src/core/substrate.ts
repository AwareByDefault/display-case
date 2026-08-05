import type { ReactNode } from 'react'
import type {
  A11yViolation,
  AuditOptions,
  CaseContext,
  DiffFn,
  DisplayCaseConfig,
  HierarchyLevel,
} from '../index'

/**
 * The rendering-substrate contract: the replaceable unit that turns a case tree
 * into something viewable.
 *
 * Display Case's pipeline — discovery, the catalog/manifest, the browse chrome,
 * tweaks, flows, and most of `check` — is substrate-neutral. The substrate owns
 * the parts that are not: producing a frame from a case tree, serializing that
 * frame, the document the chrome embeds as the stage, the client runtime (if
 * any) that paints it, the axes the showcase varies over, and the render-
 * dependent check phases.
 *
 * **Experimental.** This contract is published from the `./core` subpath so a
 * substrate can be implemented out-of-tree, but it is not yet stable: it is
 * expected to change until a second, non-DOM implementation has been built
 * against it. The built-in DOM substrate is its first implementation.
 *
 * Everything here is renderer-agnostic by construction — nothing in this module
 * imports the DOM, a server, or a bundler. `Frame` is opaque to Display Case:
 * the core only ever hands it back to the substrate's own `serialize()` and
 * `document()`. A field the core needed to read off a frame would mean the
 * abstraction is leaking.
 */
export interface Substrate<Frame = unknown> {
  /**
   * Stable identifier, used in build-cache keys, the baseline path segment, and
   * the manifest. The built-in DOM substrate's id is `'dom'`. Treat it as
   * durable: changing it re-keys a showcase's recorded baselines.
   */
  id: string

  /**
   * The axes this substrate's renderings vary over — replacing what used to be
   * a hard-coded light/dark theme plus pixel viewport presets. The chrome's
   * variant controls, the manifest, the render addresses, and the checks'
   * variant enumeration all follow this declaration.
   */
  variants: SubstrateVariantAxis[]

  /**
   * Render a case tree headlessly: no browser, no interactive client. Used by
   * the pre-scripting render, the render endpoint, the checks, publish, and the
   * `display-case render` subcommand — so whatever this produces is what every
   * surface delivers.
   *
   * MUST be deterministic for a deterministic case: the same tree, variant
   * values, and tweak values MUST produce a frame that serializes identically.
   */
  render(tree: ReactNode, ctx: SubstrateRenderContext): Promise<Frame> | Frame

  /**
   * Serialize a frame for transport, for visual baselines, and for the render
   * subcommand's stdout. `ext` is the file extension baselines are stored under
   * (`'png'`, `'txt'`, `'ansi'`, …) and decides whether a recorded baseline
   * reads as a reviewable text diff or as an opaque binary.
   */
  serialize(frame: Frame): SerializedFrame

  /**
   * Produce the **entire** document served at a case's isolated render address
   * — the stage the browse chrome embeds. The substrate owns the whole envelope
   * (fonts, background, sizing, theming signals, script tags), because that
   * envelope is exactly where a medium's assumptions live.
   *
   * The chrome depends on only two things, both stable across substrates: the
   * render address shape and the stage message protocol (see
   * {@link StageMessage}). It never reaches into this document's content.
   */
  document(frame: Frame, ctx: SubstrateDocumentContext): string

  /**
   * The client runtime that paints — and, where the substrate supports it,
   * takes over driving — a frame inside the stage document.
   *
   * Omit it entirely for a substrate whose frames are static: that is a
   * complete substrate, not a stub. Tweaks, flow steps, variant switches, and
   * deep links all remain functional, because each addresses a distinct
   * rendering the substrate produces afresh.
   */
  stage?: SubstrateStage

  /**
   * Render-dependent check phases. Each omitted member marks that phase not
   * applicable for this substrate: the run reports it as such rather than
   * failing. A consumer-configured `providers` override still wins over
   * whatever is supplied here.
   */
  checks?: SubstrateChecks<Frame>

  /**
   * Display labels for the fixed design-hierarchy levels — e.g. presenting
   * `page` as "Screens" for a terminal showcase. Purely cosmetic: the level set
   * and its order are fixed across substrates, because classification, manifest
   * grouping, the browse-mode split, and the structure rules all operate on it.
   */
  levelLabels?: Partial<Record<HierarchyLevel | 'unclassified', string>>

  /**
   * Module specifiers whose single shared copy every surface should resolve to
   * in a published build, always — the substrate's own rendering runtime. The
   * DOM substrate declares the React runtime here; a substrate whose stage is
   * not React-based is not forced to carry it. Merged with the consumer's
   * `share` and with {@link SubstrateStage.share}.
   */
  alwaysShare?: string[]
}

/** A frame serialized to bytes, with the extension baselines store it under. */
export interface SerializedFrame {
  bytes: Uint8Array
  /** Baseline file extension, without a leading dot (`'png'`, `'txt'`). */
  ext: string
}

/**
 * One axis a substrate's renderings vary over.
 *
 * The `kind` decides where the axis is honored, and it is the load-bearing
 * distinction — a `render` axis changes what the substrate produces, a `stage`
 * axis only changes how the unchanged frame is presented:
 *
 * - `'render'` — encoded in the case's address, passed to {@link
 *   Substrate.render}, enumerated by the checks, and keyed into baseline paths.
 *   The DOM substrate's light/dark theme axis is of this kind.
 * - `'stage'` — applied by the chrome around the stage without re-rendering.
 *   The DOM substrate's viewport-width axis is of this kind: it constrains the
 *   embedded stage, it does not change the document inside it.
 */
export interface SubstrateVariantAxis {
  /** Stable identifier, used as the address parameter name and the test-id key
   *  (`'theme'`, `'viewport'`, `'cols'`, `'color'`). */
  id: string
  /** Human-readable label for the chrome's control. */
  label: string
  kind: 'render' | 'stage'
  /** The values this axis can take, in presentation order. */
  values: SubstrateVariantValue[]
  /** Value used when the address names none. MUST be one of `values`. */
  default: string
}

export interface SubstrateVariantValue {
  /** The value as it appears in an address and in a baseline's variant key. */
  value: string
  /** Human-readable label for the chrome's control. */
  label: string
}

/** The client runtime that paints a substrate's frames inside the stage. */
export interface SubstrateStage {
  /**
   * Module specifier for the stage runtime, included in each per-component
   * render bundle. It receives the delivered frame and paints it; for a
   * substrate that can render client-side it may then take over driving the
   * case in place.
   */
  entry: string
  /**
   * Specifiers this stage runtime needs delivered once across a published
   * build, merged into the consumer's `share`. A terminal emulator is the
   * archetype: without this it would be inlined into every per-component
   * bundle, and the consumer would have to know its dependency names to
   * prevent that.
   */
  share?: string[]
}

/** A case's address, decoded into the parts a substrate renders from. */
export interface SubstrateCaseAddress {
  componentId: string
  caseId: string
  /** Tweak values decoded from the address (the `t.*` parameters). */
  tweaks: Record<string, string>
  /** Values for every `render`-kind axis, with declared defaults filled in. */
  variants: Record<string, string>
  /** Remaining address parameters, for options a substrate defines itself. The
   *  DOM substrate reads `fit`, `transparent`, and `width` from here. */
  params: Record<string, string>
  /**
   * The showcase's resolved configuration. A substrate is configured by the
   * showcase it renders, and needs this to honor the parts of the config that
   * are its own concern — the DOM substrate reads `theme` (root signals),
   * `styleEngines` (render-time CSS-in-JS), and `globalStyles` from here.
   * A substrate for another medium reads whatever its own factory options and
   * this config expose, and ignores the rest.
   */
  config: DisplayCaseConfig
}

/** What {@link Substrate.render} is told about the case it is rendering. */
export interface SubstrateRenderContext extends SubstrateCaseAddress {
  /** Declared browser-only (or, generally, client-only): the case opts out of
   *  headless rendering and is painted by the stage runtime instead. A
   *  substrate SHOULD return an empty frame rather than attempt the render. */
  clientOnly: boolean
}

/** What {@link Substrate.document} is told, beyond the frame itself. */
export interface SubstrateDocumentContext extends SubstrateCaseAddress {
  /**
   * URL of the built stage-runtime bundle for this component, when the
   * substrate declares a {@link SubstrateStage}. Absent for a static-frame
   * substrate — such a document carries no script of its own.
   */
  scriptSrc?: string
  /** Importmap (bare specifier → shared vendor bundle URL) for the shared
   *  runtime; `{}` when nothing is shared, which omits the map entirely. */
  importmap: Record<string, string>
  /** True when `frame` came from a headless render, false when the case is
   *  client-only and the stage runtime must produce the first paint. */
  prerendered: boolean
  /** Markup the host asks the substrate to place verbatim near the end of the
   *  document — the dev server's live-reload and error-overlay scripts. Empty
   *  in a published build, which carries no development machinery. */
  hostScripts: string
  /** Presentation resources the host resolved from the showcase's
   *  configuration. A substrate for a non-browser medium ignores these. */
  resources: SubstrateDocumentResources
}

/** Host-resolved presentation resources offered to {@link Substrate.document}. */
export interface SubstrateDocumentResources {
  /** Concatenated text of the showcase's configured `globalStyles`; `''` when
   *  none are configured. */
  globalCss: string
  /** Display Case's own design-system stylesheet text, so a showcase that
   *  dogfoods it paints before scripts. */
  vitrineCss: string
}

/** Render-dependent check phases a substrate supplies. */
export interface SubstrateChecks<Frame = unknown> {
  /**
   * The render-safety phase (surfaced as `--safety`, historically `--ssr`):
   * "this case renders headlessly without throwing". Report a finding per case
   * that cannot; return `[]` when every case is fine.
   */
  safety?(
    tree: ReactNode,
    ctx: SubstrateRenderContext,
  ): Promise<CheckFinding[]> | CheckFinding[]

  /**
   * The accessibility phase. The DOM substrate runs axe over the rendered
   * document; another medium audits what is meaningful there — for a terminal,
   * layout overflow, truncation, grapheme and wide-character handling, and
   * contrast over resolved colors.
   */
  audit?(
    frame: Frame,
    ctx: CaseContext,
    opts?: AuditOptions,
  ): Promise<A11yViolation[]>

  /**
   * Capture the bytes the visual phase compares against a baseline. Defaults to
   * `serialize(render(...))` — headless, needing neither a server nor a
   * browser. The DOM substrate overrides it, because a faithful browser
   * screenshot requires actually painting the document.
   */
  capture?(ctx: SubstrateCaptureContext): Promise<Uint8Array>

  /** Default comparison for captured bytes. A consumer's `providers.diff`
   *  overrides it. */
  diff?: DiffFn

  /**
   * Design-token conformance: does the showcase reference only vocabulary it
   * defines? The DOM substrate checks CSS custom properties. Omit it and the
   * phase reports as not applicable rather than failing.
   */
  tokens?(ctx: SubstrateTokensContext): Promise<CheckFinding[]>
}

/** What a capture is told about the case it is capturing. */
export interface SubstrateCaptureContext extends SubstrateRenderContext {
  /** Case identity in the shape snapshot providers already receive. */
  case: CaseContext
  /**
   * Address of this case's isolated rendering on a running host, when one is
   * running. A capture that needs to paint the document (the DOM substrate's
   * browser screenshot) opens it; a capture that renders headlessly ignores it
   * — and lets the run skip starting a server at all.
   */
  renderUrl?: string
}

/** What the token-conformance phase is given. */
export interface SubstrateTokensContext {
  /** Absolute path to the package being checked. */
  pkgDir: string
  /** Vocabulary names the showcase may reference without defining, from the
   *  showcase's `tokens.allow` configuration. */
  allow: string[]
}

/** A single finding from a substrate-supplied check phase. */
export interface CheckFinding {
  /** Component id the finding belongs to. */
  componentId: string
  /** Case id, when the finding is attributable to one case. */
  caseId?: string
  /** Package-relative source file, so the finding is navigable. */
  sourcePath?: string
  /** Human-readable description of what is wrong. */
  message: string
  /** `'error'` fails the run; `'warn'` is reported without failing. */
  severity: 'error' | 'warn'
}

/**
 * The message protocol between the browse chrome and the embedded stage — one
 * half of the contract a substrate must honor (the other is the render address
 * shape, `/render/<component>/<case>` plus tweak and axis parameters).
 *
 * The chrome sends {@link StageRenderMessage} to swap what the stage shows
 * without a reload. The stage announces readiness once, and reports a flow's
 * step changes back so the chrome's address and navigation stay in step.
 */
export type StageMessage =
  | StageRenderMessage
  | StageReadyMessage
  | StageStepChangedMessage

/** Chrome → stage: show this case, under these tweak and axis values. */
export interface StageRenderMessage {
  type: 'dc-render'
  componentId: string
  caseId: string
  tweaks: Record<string, string>
  /** Values for the substrate's declared axes. */
  variants: Record<string, string>
  /** Substrate-defined address options (`fit`, `transparent`, `width`). */
  params: Record<string, string>
}

/** Stage → chrome: the stage runtime has mounted and will accept messages. */
export interface StageReadyMessage {
  type: 'dc-ready'
}

/** Stage → chrome: a flow advanced to another step, so the address follows. */
export interface StageStepChangedMessage {
  type: 'dc-step-changed'
  caseId: string
  tweaks: Record<string, string>
}
