import type { ComponentType, ReactNode } from 'react'

/**
 * Public authoring API for Display Case.
 *
 * Case files import only from here. Everything in this module is pure data +
 * thin helpers — no DOM access, no server imports — so a case module is safe to
 * import both in the browser bundle (to render) and in the Bun server process
 * (to build the manifest, where render functions are never called).
 */

// ── Hierarchy ───────────────────────────────────────────────────────────────

/** Atomic Design levels, ordered by increasing composition. */
export const HIERARCHY_LEVELS = [
  'atom',
  'molecule',
  'organism',
  'template',
  'page',
  'flow',
] as const

export type HierarchyLevel = (typeof HIERARCHY_LEVELS)[number]

/**
 * Whether a level is a product *surface* (page or flow) — organized for browsing
 * by its information-architecture group (the Exhibits mode) rather than by level
 * (the Components mode). The building-block levels (atom–template) and an
 * undeclared level are not surfaces.
 */
export function isSurfaceLevel(
  level: HierarchyLevel | null | undefined,
): boolean {
  return level === 'page' || level === 'flow'
}

// ── Tweaks (typed controls) ───────────────────────────────────────────────────

export interface TextTweak {
  kind: 'text'
  default: string
}
export interface BooleanTweak {
  kind: 'boolean'
  default: boolean
}
export interface NumberTweak {
  kind: 'number'
  default: number
}
export interface ChoiceTweak {
  kind: 'choice'
  options: string[]
  default: string
}

export type TweakDescriptor =
  | TextTweak
  | BooleanTweak
  | NumberTweak
  | ChoiceTweak

export type TweakSchema = Record<string, TweakDescriptor>

/** Resolve a tweak schema to the value object handed to a render function. */
export type TweakValues<T extends TweakSchema> = {
  [K in keyof T]: T[K] extends ChoiceTweak
    ? string
    : T[K] extends TextTweak
      ? string
      : T[K] extends NumberTweak
        ? number
        : T[K] extends BooleanTweak
          ? boolean
          : never
}

/** Builders for the four serializable tweak kinds. */
export const tweak = {
  text: (defaultValue = ''): TextTweak => ({
    kind: 'text',
    default: defaultValue,
  }),
  boolean: (defaultValue = false): BooleanTweak => ({
    kind: 'boolean',
    default: defaultValue,
  }),
  number: (defaultValue = 0): NumberTweak => ({
    kind: 'number',
    default: defaultValue,
  }),
  choice: <O extends string>(options: O[], defaultValue: O): ChoiceTweak => ({
    kind: 'choice',
    options,
    default: defaultValue,
  }),
}

// ── Cases ─────────────────────────────────────────────────────────────────────

/** A case with no tweaks: a plain thunk returning the rendered variant. */
export type SimpleCase = () => ReactNode

/** A case with declared tweaks: receives the resolved tweak values. */
export interface TweakedCase<T extends TweakSchema = TweakSchema> {
  tweaks: T
  render: (values: TweakValues<T>) => ReactNode
}

export type Case = SimpleCase | TweakedCase

/**
 * Normalize an information-architecture group input into ordered path segments.
 * Accepts a `'/'`-joined string or a segment array; trims each segment and drops
 * empties. Returns `[]` for an absent/empty input (⇒ the default group).
 */
export function normalizeGroup(group: string | string[] | undefined): string[] {
  if (!group) return []
  const segments = Array.isArray(group) ? group : group.split('/')
  return segments.map((s) => s.trim()).filter((s) => s.length > 0)
}

// ── Flows (interactive multi-step flows) ────────────────────────────────────────

/**
 * Advance the flow to another named step. Optional `overrides` re-enter the
 * target step with specific tweak values (e.g. an error state); they are
 * encoded into the step's address so the resulting state is reproducible.
 */
export type GotoFn = (
  step: string,
  overrides?: Record<string, string | number | boolean>,
) => void

/**
 * One step of a flow. A step is a superset of a tweaked case: its `tweaks`
 * defaults are the step's preset state, and `render` additionally receives a
 * `goto` to wire into a presentational view's callbacks. `transitions` names the
 * steps this step can advance to — the catalog's source of truth for the flow
 * graph (kept declarative so the manifest builds without executing `render`).
 */
export interface FlowStep<T extends TweakSchema = TweakSchema> {
  tweaks?: T
  transitions?: string[]
  render: (ctx: { values: TweakValues<T>; goto: GotoFn }) => ReactNode
}

export interface CaseMeta {
  level?: HierarchyLevel
  /**
   * Information-architecture group for a page/flow surface — where it sits in the
   * Exhibits-mode navigation tree, as a path (`'App/Settings/Billing'` or
   * `['App','Settings','Billing']`). Distinct from `area` (which selects decorator
   * chrome): `group` is purely a navigation concern. Ignored for building-block
   * levels (atom–template), which group by `level`. Omit to derive the group from
   * the case file's folder, then showcase config, then a default group.
   */
  group?: string | string[]
  /**
   * Free-form area/layout tag passed to the decorator, for wrapping a case in
   * app chrome (nav/header/footer). The decorator interprets the value (Display
   * Case mandates no vocabulary). Takes precedence over folder-based detection
   * via `sourcePath`; omit to fall back to that (or to render bare).
   */
  area?: string
  /**
   * Declare this component's cases as browser-only: they need a browser to
   * render (they touch `window`, layout measurement, canvas… *during render*,
   * not just in effects) and so cannot be server-rendered before scripts run.
   * Display Case renders them on the client instead — the same fallback a case
   * that *throws* under server rendering gets — and the `ssr` check treats them
   * as expected rather than a failure. Prefer keeping render pure (browser APIs
   * belong in effects/handlers); use this only when a component genuinely can't.
   */
  browserOnly?: boolean
}

/**
 * A discovered case module. This is the default-export shape every `*.case.tsx`
 * file produces, and the unit the server reads to build the manifest.
 */
export interface CaseModule {
  /** Display name of the showcased component. */
  component: string
  /** Place in the Atomic Design hierarchy; undeclared ⇒ "unclassified". */
  level?: HierarchyLevel
  /** Ordered cases (or flow steps), keyed by display name (insertion order preserved). */
  cases: Record<string, Case | FlowStep>
  /** True when this module is a flow: its cases are ordered, transitionable steps. */
  isFlow: boolean
  /** Source path relative to the package, injected by codegen (for area-aware chrome). */
  sourcePath?: string
  /** Normalized information-architecture group path (see CaseMeta.group); empty
   *  when undeclared. Only meaningful for page/flow surfaces. */
  group?: string[]
  /** Free-form area/layout tag (see CaseMeta.area); overrides `sourcePath`. */
  area?: string
  /** Declared browser-only (see CaseMeta.browserOnly): skip server rendering and
   *  let the `ssr` check pass these cases instead of flagging them. */
  browserOnly?: boolean
}

/**
 * Declare the cases for a single component.
 *
 * @example
 * export default defineCases('Button', {
 *   Default: () => <Button>Save</Button>,
 * }, { level: 'atom' })
 */
export function defineCases(
  component: string,
  cases: Record<string, Case>,
  meta: CaseMeta = {},
): CaseModule {
  return {
    component,
    cases,
    level: meta.level,
    isFlow: false,
    group: normalizeGroup(meta.group),
    area: meta.area,
    browserOnly: meta.browserOnly,
  }
}

/**
 * Declare an interactive flow: an ordered set of named steps demonstrating a
 * behavioural page or user flow. Each step is individually addressable and
 * snapshottable; a step may declare preset `tweaks`, `transitions` to other
 * steps, and wire its `goto` into a presentational view's callbacks. A flow
 * whose steps declare no transitions is a static, walkable page sequence.
 *
 * @example
 * export default defineFlow('Sign-in', {
 *   steps: {
 *     'Request link': {
 *       render: ({ goto }) => <RequestLink onSubmit={() => goto('Check email')} />,
 *     },
 *     'Check email': { render: () => <CheckEmail /> },
 *   },
 * })
 */
export function defineFlow(
  name: string,
  // Steps may each declare a different tweak schema (e.g. via `flowStep`), so the
  // record is over `FlowStep<any>` — a `FlowStep<{ error }>` is not assignable to
  // the invariant `FlowStep<TweakSchema>`.
  config: {
    steps: Record<string, FlowStep<any>>
    group?: string | string[]
    area?: string
    browserOnly?: boolean
  },
): CaseModule {
  return {
    component: name,
    cases: config.steps,
    level: 'flow',
    isFlow: true,
    group: normalizeGroup(config.group),
    area: config.area,
    browserOnly: config.browserOnly,
  }
}

/**
 * Identity helper that infers a flow step's tweak schema from its own `tweaks`,
 * so `render`'s `values` is typed per step (`values.error` is `boolean`, not a
 * loose union). Wrap a step that reads typed `values`:
 *
 * @example
 * 'Check email': flowStep({
 *   tweaks: { error: tweak.boolean(false) },
 *   render: ({ values, goto }) => <CheckEmail error={values.error} … />,
 * })
 *
 * A bare step object still works (its `values` is just loosely typed). `goto`
 * and `transitions` targets are not key-checked at compile time — an unknown
 * target renders the not-found step at runtime (see Case discovery).
 */
export function flowStep<T extends TweakSchema = Record<never, never>>(
  step: FlowStep<T>,
): FlowStep<T> {
  return step
}

// ── Snapshot providers (visual-regression backend) ──────────────────────────

/** Identity of the case being rendered, passed to snapshot providers. */
export interface CaseContext {
  componentId: string
  caseId: string
  theme: 'light' | 'dark'
  width: number
}

/** axe severity, worst → least: how seriously to take a violation. `null` when
 *  the driver doesn't classify it. */
export type A11yImpact = 'critical' | 'serious' | 'moderate' | 'minor'

export interface A11yViolation {
  id: string
  help: string
  nodes: number
  /** Severity, used to order results (worst first); `null` if unclassified. */
  impact: A11yImpact | null
  /** Per-node detail (the failing element and, for colour-contrast, the measured
   *  vs required values). Populated when the driver captures it; omitted by
   *  drivers that report only counts. Persisted in the on-disk cache and printed
   *  by the CLI so a finding is actionable without re-running — the live UI still
   *  shows only the summary above (`id`/`help`/`nodes`/`impact`). */
  details?: A11yNodeDetail[]
}

/** One failing node within an {@link A11yViolation}. */
export interface A11yNodeDetail {
  /** CSS selector path to the failing element (axe's `target`, joined). */
  target: string
  /** Truncated `outerHTML` of the element, for identification. */
  html: string
  /** axe's human-readable explanation for this node, when available. */
  failureSummary?: string
  /** Present for `color-contrast` findings: the measured pair and threshold,
   *  so the exact failing colours are readable without opening a browser. */
  contrast?: A11yContrast
}

/** The measured colour pair behind a `color-contrast` finding. */
export interface A11yContrast {
  /** Foreground (text) colour, as axe reports it (e.g. `#8a8073`). */
  foreground: string
  /** Background colour behind the text. */
  background: string
  /** Measured contrast ratio (e.g. `3.71`). */
  ratio: number
  /** Ratio the text must meet to pass (`4.5` normal, `3` large). */
  required: number
  /** Computed font size axe used to pick the threshold (e.g. `12.0pt`). */
  fontSize?: string
  /** Computed font weight axe used to pick the threshold (e.g. `400`). */
  fontWeight?: string
}

/** Options for a single accessibility audit — shared by the CLI gate and the
 *  live in-app scanner so they agree on what counts as a violation. */
export interface AuditOptions {
  /** Rule ids to exclude from the audit. */
  exclude?: string[]
}

/** A page opened by a {@link RenderDriver}: capture an image, audit a11y. */
export interface RenderedPage {
  screenshot(): Promise<Uint8Array>
  /** Accessibility violations (WCAG A/AA); `[]` if the driver skips auditing. */
  audit(opts?: AuditOptions): Promise<A11yViolation[]>
  dispose(): Promise<void>
}

/** Opens case render URLs and yields pages; reused across all cases. */
export interface RenderDriver {
  open(url: string, ctx: CaseContext): Promise<RenderedPage>
  close(): Promise<void>
}

export interface DiffResult {
  changed: boolean
  mismatch?: number
  /** Optional diff image the runner writes next to the baseline on a change. */
  diffImage?: Uint8Array
}

/**
 * Compares a rendered case against its baseline. The second argument carries the
 * case identity (Option B) — pure diffs ignore it; identity-aware ones (per-case
 * tolerance, name-keyed hosted services) use it.
 */
export type DiffFn = (
  input: { baseline: Uint8Array; actual: Uint8Array },
  ctx: CaseContext & { baselinePath: string },
) => DiffResult | Promise<DiffResult>

export interface SnapshotProviders {
  /** Render-driver factory; default = built-in Playwright + axe driver. */
  driver?: () => RenderDriver | Promise<RenderDriver>
  /** Image comparison; default = built-in pixelmatch/pngjs diff. */
  diff?: DiffFn
}

// ── Structure checks (static best-practice rules) ────────────────────────────

/** Identifier for each `--structure` best-practice rule. */
export type StructureRuleId =
  // File / config rules
  | 'case-placard-coverage'
  | 'no-orphaned-placard-doc'
  | 'primer-present-and-used'
  | 'setup-present'
  | 'config-paths-exist'
  // Catalog-integrity rules
  | 'levels-classified'
  | 'cases-load'
  | 'flow-transitions-resolve'
  | 'flow-multi-step'
  | 'unique-slugs'
  | 'tweak-defaults-valid'
  | 'nav-groups-resolve'
  // Case-content rules
  | 'interactive-cases-keyed'
  // Composition (import-graph) rules — opt-in, default off
  | 'atom-purity'
  | 'no-downward-dependency'
  | 'composes-lower-level'
  | 'level-fit'

/** A finding either warns (reported, non-fatal) or errors (fails the run). */
export type StructureSeverity = 'warn' | 'error'

/**
 * Per-rule configuration:
 *  - `false`            ⇒ disabled
 *  - `'warn'` / `'error'` ⇒ enabled, overriding the rule's default severity
 *  - an options object  ⇒ enabled with per-rule overrides
 */
export type StructureRuleSetting =
  | false
  | StructureSeverity
  | StructureRuleOptions

export interface StructureRuleOptions {
  /** Override the rule's default severity. */
  severity?: StructureSeverity
  /** Package-relative globs whose matches this rule skips. */
  ignore?: string[]
  /**
   * `level-fit` only: max lower-level components a level may compose before the
   * rule suggests promotion. Unset levels use built-in defaults.
   */
  thresholds?: Partial<Record<HierarchyLevel, number>>
}

/** Phases selectable by `display-case check`. */
export type CheckPhase = 'tokens' | 'a11y' | 'visual' | 'structure' | 'ssr'

export interface CheckConfig {
  /**
   * Whether each phase participates in the default (no-phase-flag) run.
   * Unset ⇒ included. Set `false` to opt a phase out of the default run; it can
   * still be invoked explicitly by naming its flag.
   */
  defaultPhases?: Partial<Record<CheckPhase, boolean>>
  /**
   * How many variants the render phases (a11y/visual) scan concurrently. The
   * built-in Playwright driver opens one page per variant from a shared browser
   * context, so concurrent pages overlap the browser-bound work. Default 4; CLI
   * `--concurrency=N` overrides. A custom `providers.driver` MUST tolerate
   * concurrent `open()` calls for values above 1 (set this to `1` if it can't).
   */
  concurrency?: number
  /** Structure-phase rule configuration; each rule is on (at its default severity) unless overridden. */
  structure?: {
    /** Treat every structure warning as an error for the run (CI strict mode). */
    strict?: boolean
    rules?: Partial<Record<StructureRuleId, StructureRuleSetting>>
  }
}

// ── Style engines (render-time CSS-in-JS) ───────────────────────────────────────

/**
 * Collects the styling a single server render emits and returns it as document
 * `<head>` markup. One collector instance serves exactly one render, so its
 * store is isolated — one case's render-time styling never leaks into another's
 * document. See {@link StyleEngine}.
 */
export interface StyleCollector {
  /**
   * Wrap the tree about to be rendered in whatever provider the styling library
   * needs, so its render-time styling accumulates in this collector's isolated
   * store (e.g. an emotion `CacheProvider` over a fresh cache).
   */
  wrap(node: ReactNode): ReactNode
  /**
   * Given the already-rendered markup, return the `<head>` markup (e.g.
   * `<style data-…>…</style>` tags) carrying the styling that render used — placed
   * verbatim, after the document's static styles, before scripting. Return `''`
   * when the render produced none. MUST be idempotent: the tree renders inside
   * `StrictMode` and may render twice.
   */
  collect(renderedHtml: string): string
}

/**
 * A factory invoked once per server render to produce an isolated
 * {@link StyleCollector}. Configure one or more on
 * {@link DisplayCaseConfig.styleEngines} to deliver render-time (CSS-in-JS)
 * styling — emotion/Material UI, styled-components, and peers — before scripting.
 * Pair with `decorator` for the client-side provider. See `docs/style-engines.md`.
 */
export type StyleEngine = () => StyleCollector

// ── Navigation / information architecture ────────────────────────────────────

/** A rule assigning a page/flow surface to an information-architecture group. */
export interface NavSurfaceRule {
  /** Match the surface's component id (slug) exactly, or a glob against its
   *  package-relative case-file path (e.g. `app/admin/**`). */
  id?: string
  /** Match the surface's `area` tag. */
  area?: string
  /** The group to assign (path string or segments). */
  group: string | string[]
}

/** Curation of the Exhibits-mode information-architecture groups. */
export interface NavGroupsConfig {
  /**
   * Order in which groups appear, each a top-level segment or a `'/'`-joined
   * path (matched case-insensitively). Groups not listed follow in the default
   * order.
   */
  order?: string[]
  /** Override a group's display label, keyed by its segment or `'/'`-joined path
   *  (case-insensitive). */
  labels?: Record<string, string>
  /** Groups collapsed by default on first load, by segment or `'/'`-joined path. */
  collapsed?: string[]
}

/** Navigation / information-architecture configuration for the browse chrome. */
export interface NavConfig {
  /** Derive a surface's group from its case-file folder. Default `true`. */
  deriveFromFolder?: boolean
  /** Map surfaces to groups when their folders don't mirror the IA. First match
   *  wins; consulted after an explicit `group` and folder derivation. */
  surface?: NavSurfaceRule[]
  /** Group ordering, labels, and default-collapsed state. */
  groups?: NavGroupsConfig
  /**
   * How a flow is distinguished from a page in the Exhibits sidebar:
   * `'tag'` (default) appends a high-visibility `flow` pill after the name;
   * `'glyph'` prefixes the flow row with a leading flow glyph. Either way a
   * flow's step rows are numbered, and pages render plain.
   */
  flowMarker?: 'glyph' | 'tag'
}

// ── Config ─────────────────────────────────────────────────────────────────────

export interface DisplayCaseConfig {
  /** Title shown in the browsing chrome and the manifest. */
  title: string
  /** Globs (relative to the consumer package) that locate `*.case.tsx` files. */
  roots: string[]
  /**
   * Path (relative to the consumer package) to an `.mdx` document rendered as
   * the Primer — a long-form "wall text" reading page with embedded live
   * specimens. The document may import any component (case files and arbitrary
   * `.tsx`) and wraps each specimen in the `<Display>` contract (re-exported
   * from this package). When set, the browse chrome shows a Primer / Cases
   * mode switch in the sidebar.
   */
  primer?: string
  /**
   * Which browse mode the chrome lands on at the root path (`/`): the Primer
   * reading page, the Components kit, or the Exhibits surfaces. Honored only when
   * that mode is present (has content); otherwise the first present mode is used,
   * in order primer → components → exhibits. A deep link to a specific case always
   * opens that case. Defaults to the primer when one is configured, else the first
   * present mode.
   */
  landing?: 'primer' | 'components' | 'exhibits'
  /**
   * Navigation / information-architecture configuration: how page/flow surfaces
   * are grouped in the Exhibits browse mode (folder derivation, surface→group
   * mapping, group order/labels/default-collapsed). Absent ⇒ groups derive from
   * folders, ordered deterministically, none collapsed.
   */
  nav?: NavConfig
  /** CSS entrypoints (relative to the consumer package) injected into previews. */
  globalStyles?: string[]
  /**
   * Optional wrapper rendered around every case (e.g. a theme provider). Receives
   * the active case's `level` and `sourcePath` so it can wrap page/flow cases in
   * area-appropriate app chrome (nav/header) while leaving smaller components bare.
   */
  decorator?: ComponentType<{
    children: ReactNode
    level?: HierarchyLevel
    sourcePath?: string
    area?: string
  }>
  /**
   * Engines that collect render-time (CSS-in-JS) styling — emotion/Material UI,
   * styled-components, and peers — during the pre-scripting server render and
   * deliver it in the isolated render and primer documents before scripting, so
   * those surfaces are styled without executing scripts (no flash, styled
   * snapshots). Applied in array order (the first is outermost). Each is a
   * factory invoked once per render for an isolated style store. Pair with
   * `decorator` for the client-side provider. Omit for none (documents are then
   * byte-identical to their engine-free form). See `docs/style-engines.md`.
   */
  styleEngines?: StyleEngine[]
  /**
   * Where visual-regression baselines are stored, relative to the consumer
   * package. Defaults to the gitignored cache at `.display-case/baselines`.
   * Point at a committed directory to opt into shared / CI-gating baselines.
   */
  baselineDir?: string
  /** Design-token conformance options for the `--tokens` check. */
  tokens?: {
    /**
     * Custom-property names the package may reference but does not itself
     * define — e.g. tokens supplied by a host application's global stylesheet,
     * or set by the browser. Listed names are treated as defined.
     */
    allow?: string[]
  }
  /**
   * Override the visual-regression backend. When unset, the built-in default
   * (Playwright + axe driver, pixelmatch/pngjs diff) is loaded lazily.
   */
  providers?: SnapshotProviders
  /**
   * Check-command configuration: which phases run by default, and the structure
   * phase's best-practice rules. Absent ⇒ every phase runs and every non-opt-in
   * rule is enabled at its default severity.
   */
  check?: CheckConfig
  /**
   * In-app accessibility surfacing on the running browse server. Off by default:
   * the headless-browser + axe toolchain is an optional, lazily-loaded
   * prerequisite, not an assumed dependency. `enabled` gates only the live
   * surface (nav markers + Accessibility panel); the `check` CLI gate runs
   * whenever invoked regardless of it. `themes` and `exclude` are shared scan
   * parameters honored by BOTH the live surface and the CLI gate, so the panel
   * and CI agree on what counts as a violation.
   */
  a11y?: {
    /** Surface accessibility results in the running browse chrome. Default false. */
    enabled?: boolean
    /** Themes to audit (live surface + CLI gate). Default: light and dark. */
    themes?: ('light' | 'dark')[]
    /** axe rule ids to exclude from audits (live surface + CLI gate). */
    exclude?: string[]
    /**
     * How the navigation's accessibility markers are populated when the server
     * starts (only meaningful with `enabled`). Default `'off'`.
     * - `'off'`    — no start-up population; a variant's marker appears only once
     *                that variant is viewed (the on-demand default).
     * - `'cached'` — populate markers from reusable cached results at start-up,
     *                running no scans; uncached/stale variants stay unmarked
     *                until viewed.
     * - `'refresh'`— at start-up scan every uncached or stale variant, surfacing
     *                each verdict as it lands, while reusing fresh cached results.
     */
    startup?: 'off' | 'cached' | 'refresh'
  }
}

/** Identity helper that gives a config file full type-checking + inference. */
export function defineConfig(config: DisplayCaseConfig): DisplayCaseConfig {
  return config
}
