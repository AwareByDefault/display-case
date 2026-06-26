// display-case: no-case — shared static fixtures for the chrome's page/template/
// flow exhibits, not a showcased component of its own.
//
// These build a complete, static {@link ShellViewModel} (the same shape
// {@link useShell} produces live) so the pure {@link ShellView} can be exhibited
// as a template (placeholder slots), a page (real content slotted in), and a
// flow (Primer ↔ Cases) — Display Case dogfooding its own layout end to end.
import type { ReactNode } from 'react'
import { slugify } from '../../../../core/catalog'
import type {
  Manifest,
  ManifestCase,
  ManifestComponent,
} from '../../../../core/manifest'
import type { A11yViolation, TweakSchema } from '../../../../index'
import { Display } from '../../../primer'
import {
  buildExhibitView,
  groupByLevel,
  groupPrimerSections,
} from '../../../shell-core'
import type { A11ySurface, ShellViewModel } from '../../../use-shell'
import { Button, Chip } from '..'

const noop = () => {}
const nullRef = { current: null }

function mkCase(
  componentId: string,
  name: string,
  opts: { tweaks?: TweakSchema; transitions?: string[] } = {},
): ManifestCase {
  const id = slugify(name)
  return {
    id,
    name,
    browseUrl: `/c/${componentId}/${id}`,
    renderUrl: `/render/${componentId}/${id}`,
    tweaks: opts.tweaks ?? null,
    transitions: opts.transitions ?? [],
  }
}

function mkComponent(
  c: Pick<ManifestComponent, 'id' | 'name' | 'level'> &
    Partial<ManifestComponent> & { cases: ManifestCase[] },
): ManifestComponent {
  return {
    isFlow: false,
    group: [],
    caseFile: `src/ui/design-system/components/${c.id}.case.tsx`,
    placardDoc: null,
    ...c,
  }
}

const PLACEHOLDER_TWEAKS: TweakSchema = {
  property: { kind: 'text', default: 'value' },
}

// The real Button Playground schema (mirrors controls/Button.case.tsx), so the
// Button page's tweaks exhibits show the actual controls — and their default
// values — that drive the Playground button on the stage.
export const BUTTON_PLAYGROUND_TWEAKS: TweakSchema = {
  label: { kind: 'text', default: 'Button' },
  variant: {
    kind: 'choice',
    options: ['ghost', 'primary', 'accent', 'subtle'],
    default: 'ghost',
  },
  size: { kind: 'choice', options: ['sm', 'md', 'lg'], default: 'md' },
  pressed: { kind: 'boolean', default: false },
  disabled: { kind: 'boolean', default: false },
}

/**
 * A representative manifest spanning every hierarchy level, so the exhibited
 * chrome's nav rail shows the full Atoms → Flows ladder (just like a real
 * Display Case). It is data only — the exhibits slot their own live content onto
 * the stage rather than loading these `renderUrl`s.
 */
export const mockManifest: Manifest = {
  title: 'Display Case',
  modes: ['primer', 'components', 'exhibits'],
  landing: 'primer',
  groups: [],
  components: [
    mkComponent({
      id: 'button',
      name: 'Button',
      level: 'atom',
      placardDoc: 'src/ui/design-system/components/showcase/Button.placard.md',
      cases: [
        mkCase('button', 'Playground', { tweaks: BUTTON_PLAYGROUND_TWEAKS }),
        mkCase('button', 'Variants'),
        mkCase('button', 'Sizes'),
      ],
    }),
    mkComponent({
      id: 'input',
      name: 'Input',
      level: 'atom',
      cases: [mkCase('input', 'Default'), mkCase('input', 'Sizes')],
    }),
    mkComponent({
      id: 'render-address',
      name: 'RenderAddress',
      level: 'molecule',
      cases: [mkCase('render-address', 'Default')],
    }),
    mkComponent({
      id: 'tweaks-panel',
      name: 'TweaksPanel',
      level: 'molecule',
      cases: [
        mkCase('tweaks-panel', 'Playground', { tweaks: PLACEHOLDER_TWEAKS }),
        mkCase('tweaks-panel', 'Docked'),
      ],
    }),
    mkComponent({
      id: 'sidebar',
      name: 'Sidebar',
      level: 'organism',
      cases: [mkCase('sidebar', 'Default')],
    }),
    mkComponent({
      id: 'case-template',
      name: 'Case template',
      level: 'template',
      cases: [mkCase('case-template', 'Default')],
    }),
    mkComponent({
      id: 'cases-page',
      name: 'Cases page',
      level: 'page',
      cases: [mkCase('cases-page', 'Default')],
    }),
    mkComponent({
      id: 'primer-page',
      name: 'Primer page',
      level: 'page',
      cases: [mkCase('primer-page', 'Default')],
    }),
    mkComponent({
      id: 'a11y-page',
      name: 'A11y page',
      level: 'page',
      cases: [mkCase('a11y-page', 'Default')],
    }),
    mkComponent({
      id: 'primer-to-cases',
      name: 'Primer to Cases',
      level: 'flow',
      isFlow: true,
      cases: [
        mkCase('primer-to-cases', 'Primer view', {
          transitions: [slugify('Cases view')],
        }),
        mkCase('primer-to-cases', 'Cases view', {
          transitions: [slugify('Primer view')],
        }),
      ],
    }),
    // A representative product flow, so the Cases view's "Flow" exhibit shows
    // the FlowNav stepper over a real-looking sequence of steps.
    mkComponent({
      id: 'sign-in',
      name: 'Sign-in',
      level: 'flow',
      isFlow: true,
      cases: [
        mkCase('sign-in', 'Request link', {
          transitions: [slugify('Check email')],
        }),
        mkCase('sign-in', 'Check email', {
          transitions: [slugify('Confirmed')],
        }),
        mkCase('sign-in', 'Confirmed'),
      ],
    }),
  ],
}

// A static Primer table of contents for the primer-mode exhibits.
const MOCK_PRIMER_SECTIONS = [
  { id: 'heading-foundations', title: 'Foundations', kind: 'heading' as const },
  { id: 'section-color', title: 'Color', kind: 'display' as const },
  { id: 'section-type', title: 'Type scale', kind: 'display' as const },
  { id: 'heading-components', title: 'Components', kind: 'heading' as const },
  { id: 'section-button', title: 'Button', kind: 'display' as const },
]

// A "Case template" component carrying a tweak schema and a placard-doc, so an
// exhibit that selects it shows every layout piece at once — stage, tweaks
// panel, and docs panel. The plain entry in `mockManifest` keeps the nav rail
// honest; this richer twin (same id) is what the template/page exhibits put on
// the stage.
const richCaseComponent: ManifestComponent = mkComponent({
  id: 'case-template',
  name: 'Case template',
  level: 'template',
  placardDoc: 'src/ui/design-system/components/shell/CaseTemplate.placard.md',
  cases: [mkCase('case-template', 'Default', { tweaks: PLACEHOLDER_TWEAKS })],
})

/** Selection override that puts the rich "Case template" exhibit on the stage. */
export function caseTemplateSelection(): Partial<ShellViewModel> {
  // richCaseComponent is constructed with exactly one case, so [0] is present.
  const activeCase = richCaseComponent.cases[0]!
  const sel = {
    componentId: richCaseComponent.id,
    caseId: activeCase.id,
    tweaks: {},
  }
  return {
    component: richCaseComponent,
    activeCase,
    sel,
    shownSel: sel,
    expanded: new Set([richCaseComponent.id]),
    addressUrl: `https://display-case.dev${activeCase.renderUrl}?theme=light`,
    docOpen: true,
  }
}

/** Placeholder prose for the docs panel in the Case-template exhibit. */
export const PLACEHOLDER_DOC = `## Documentation

A page's documentation panel renders the component's \`*.placard.md\` here —
usage notes, examples, and the props an agent needs to use it correctly.

- First, the **why**: what this piece is for.
- Then, the **how**: the props and a worked example.`

/** Pick a component + case out of a manifest and the selection that targets it. */
export function selectIn(
  manifest: Manifest,
  componentId: string,
  caseId?: string,
) {
  const component =
    manifest.components.find((c) => c.id === componentId) ?? null
  const activeCase =
    component?.cases.find((c) => c.id === caseId) ?? component?.cases[0] ?? null
  const sel =
    component && activeCase
      ? { componentId: component.id, caseId: activeCase.id, tweaks: {} }
      : null
  return {
    component,
    activeCase,
    sel,
    shownSel: sel,
    expanded: new Set(component ? [component.id] : []),
    // A fixed origin (not the ephemeral dev-server port) keeps the exhibit's
    // address bar deterministic for visual-regression snapshots.
    addressUrl: activeCase
      ? `https://display-case.dev${activeCase.renderUrl}?theme=light`
      : '',
  }
}

// Real violations taken from an actual `display-case check --a11y` run over
// Display Case's own TweaksPanel case — so the exhibit reads like a real audit,
// with axe's real severities, not lorem ipsum.
const MOCK_VIOLATIONS: A11yViolation[] = [
  {
    id: 'color-contrast',
    help: 'Elements must meet minimum color contrast ratio thresholds',
    nodes: 3,
    impact: 'serious',
  },
  {
    id: 'label',
    help: 'Form elements must have labels',
    nodes: 1,
    impact: 'critical',
  },
  {
    id: 'select-name',
    help: 'Select element must have an accessible name',
    nodes: 1,
    impact: 'serious',
  },
]

/**
 * A static {@link A11ySurface} for the a11y-surfacing exhibit: per-variant nav
 * markers across a few library components (so the rail shows which have issues at
 * a glance) plus the selected variant's violation list (the stage's a11y panel).
 * The selected variant's count lines up with the panel's list, so the nav marker
 * and the panel tell one consistent story.
 */
export function mockA11y(): A11ySurface {
  return {
    byVariant: {
      button: { playground: 3 },
      input: { default: 3 },
      'render-address': { default: 1 },
      'tweaks-panel': { docked: 2 },
    },
    current: MOCK_VIOLATIONS,
  }
}

// A deliberately long audit — more violations than the height-capped panel can
// show at once — to exercise its internal scroll (with the sticky header).
const MANY_VIOLATIONS: A11yViolation[] = [
  {
    id: 'color-contrast',
    help: 'Elements must meet minimum color contrast ratio thresholds',
    nodes: 7,
    impact: 'serious',
  },
  {
    id: 'label',
    help: 'Form elements must have labels',
    nodes: 4,
    impact: 'critical',
  },
  {
    id: 'link-name',
    help: 'Links must have discernible text',
    nodes: 3,
    impact: 'serious',
  },
  {
    id: 'button-name',
    help: 'Buttons must have discernible text',
    nodes: 2,
    impact: 'critical',
  },
  {
    id: 'image-alt',
    help: 'Images must have alternate text',
    nodes: 5,
    impact: 'critical',
  },
  {
    id: 'aria-required-attr',
    help: 'Required ARIA attributes must be provided',
    nodes: 1,
    impact: 'critical',
  },
  {
    id: 'aria-valid-attr-value',
    help: 'ARIA attributes must conform to valid values',
    nodes: 2,
    impact: 'serious',
  },
  {
    id: 'duplicate-id',
    help: 'id attribute values must be unique',
    nodes: 3,
    impact: 'minor',
  },
  {
    id: 'heading-order',
    help: 'Heading levels should only increase by one',
    nodes: 1,
    impact: 'moderate',
  },
  {
    id: 'list',
    help: 'Lists must only directly contain li elements',
    nodes: 2,
    impact: 'serious',
  },
  {
    id: 'tabindex',
    help: 'Elements should not have a tabindex greater than zero',
    nodes: 4,
    impact: 'serious',
  },
  {
    id: 'region',
    help: 'All page content should be contained by landmarks',
    nodes: 6,
    impact: 'moderate',
  },
]

/** Like {@link mockA11y}, but with a violation list long enough to overflow the
 *  panel — for the page-case variant that proves the scroll + sticky header. */
export function mockA11yScrolling(): A11ySurface {
  return {
    byVariant: {
      input: { default: MANY_VIOLATIONS.length },
      'render-address': { default: 1 },
    },
    current: MANY_VIOLATIONS,
  }
}

/**
 * A static {@link A11ySurface} that shows the per-variant nav breakdown: `button`
 * is selected (and expanded) with its three variants carrying different counts —
 * Playground 2, Variants 5, Sizes clean — so the parent row shows a plain dot
 * while the per-variant numbers sit on the case rows. Other components stay
 * collapsed, showing their summed counts for contrast. The panel lists the
 * selected variant (`button` / Variants → 5 violations).
 */
export function mockA11yPerVariant(): A11ySurface {
  return {
    byVariant: {
      button: { playground: 2, variants: 5 },
      input: { default: 3 },
      'render-address': { default: 1 },
    },
    current: MANY_VIOLATIONS.slice(0, 5),
  }
}

/**
 * A static {@link A11ySurface} for the single-case-leaf situation: `RenderAddress`
 * is a one-variant component, so it renders as a leaf (no chevron, no case rows).
 * With no children to defer to, its lone variant's count sits directly on the
 * leaf row — never a dot. The page case selects it, so the marker shows on the
 * selected (marigold) row. Multi-case `button` stays collapsed for contrast.
 */
export function mockA11yLeaf(): A11ySurface {
  return {
    byVariant: {
      button: { playground: 2, variants: 5 },
      input: { default: 3 },
      'render-address': { default: 2 },
    },
    current: MANY_VIOLATIONS.slice(0, 2),
  }
}

/** A11y configured but the active variant's scan is still in flight: the panel
 *  shows its calm "Scanning…" state, and no nav markers have landed yet. */
export function mockA11yPending(): A11ySurface {
  return { byVariant: {}, current: 'pending' }
}

/** A11y configured and everything is clean: no nav markers anywhere and the
 *  panel shows its reassuring all-green pass state. */
export function mockA11yClean(): A11ySurface {
  return { byVariant: {}, current: [] }
}

/**
 * Build a complete, static {@link ShellViewModel}. Defaults paint a calm,
 * fully-revealed library view of {@link mockManifest}; pass `overrides` to set
 * the mode, the selected exhibit, the stage geometry, or wire `setMode` to a
 * flow's `goto`. Handlers default to no-ops and the live-frame refs to null —
 * an exhibit drives the stage through the `renderFrame` / `primerFrame` slots,
 * not the iframes.
 */
export function makeModel(
  overrides: Partial<ShellViewModel> = {},
): ShellViewModel {
  const picked = selectIn(mockManifest, 'button', 'playground')
  const base: ShellViewModel = {
    manifest: mockManifest,
    theme: 'light',
    setTheme: noop,
    navCollapsed: false,
    setNavCollapsed: noop,
    sidebarWidth: 240,
    startSidebarResize: noop,
    onSidebarResizeKey: noop,
    mode: 'components',
    setMode: noop,
    shownMode: 'components',
    modeFadeStyle: { opacity: 1 },
    sizeId: 'full',
    setSizeId: noop,
    manualZoom: 1,
    setManualZoom: noop,
    showGrid: true,
    setShowGrid: noop,
    widthInputValue: '',
    fixed: null,
    fitted: false,
    scale: 1,
    sizeMeta: 'Responsive',
    editDim: noop,
    rotateDims: noop,
    stageDecor: true,
    component: picked.component,
    activeCase: picked.activeCase,
    addressUrl: picked.addressUrl,
    shownSel: picked.shownSel,
    sel: picked.sel,
    docOpen: false,
    changeDocsOpen: noop,
    docText: null,
    docWidth: 352,
    startDocResize: noop,
    onDocResizeKey: noop,
    tweaksFloating: false,
    setTweaksFloating: noop,
    navScrollRef: nullRef,
    navBodyRef: nullRef,
    groups: groupByLevel(mockManifest.components),
    exhibitView: buildExhibitView(mockManifest),
    filter: '',
    setFilter: noop,
    breadcrumb: [],
    expanded: picked.expanded,
    toggleExpanded: noop,
    selectComponent: noop,
    select: noop,
    primerGroups: groupPrimerSections(MOCK_PRIMER_SECTIONS),
    primerActive: MOCK_PRIMER_SECTIONS[0]!.id,
    // Accordion: one TOC group open at a time, tracking the active section
    // (see useShell — the scrollspy effect that drives primerExpanded).
    primerExpanded: new Set(['heading-foundations']),
    togglePrimerGroup: noop,
    scrollToSection: noop,
    attachPreview: noop,
    padX: 32,
    padY: 32,
    stageShown: true,
    boxW: 320,
    boxH: 200,
    frameRef: nullRef,
    frameSrc: null,
    targetW: 320,
    renderH: 200,
    primerRef: nullRef,
    primerSrc: null,
  }
  return { ...base, ...overrides }
}

/** A dashed placeholder standing in for a component on the stage (templates). */
export function PlaceholderExhibit({
  label = 'Component',
}: {
  label?: string
}): ReactNode {
  return (
    <div
      style={{
        display: 'grid',
        placeItems: 'center',
        width: '100%',
        height: '100%',
        minHeight: '120px',
        minWidth: '180px',
        border: '1px dashed var(--dc-border)',
        borderRadius: 'var(--dc-radius-md)',
        color: 'var(--dc-fg-subtle)',
        fontFamily: 'var(--dc-font-mono)',
        fontSize: 'var(--dc-text-sm)',
      }}>
      {label}
    </div>
  )
}

/** Center a live exhibit inside the stage's frame box (pages). */
export function StageSlot({ children }: { children: ReactNode }): ReactNode {
  return (
    <div
      style={{
        display: 'grid',
        placeItems: 'center',
        width: '100%',
        height: '100%',
      }}>
      {children}
    </div>
  )
}

/**
 * A full-bleed app screen for the Cases view's "Page" exhibit. A page-level
 * component flips `stageDecor` off, so the stage drops its grid and padding and
 * the exhibit fills the frame edge to edge — this screen shows that fill: a top
 * bar and a body that reach the borders, no centred vitrine.
 */
export function PageScreen(): ReactNode {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        background: 'var(--dc-bg)',
        color: 'var(--dc-fg)',
        fontFamily: 'var(--dc-font-sans)',
        fontSize: 'var(--dc-text-sm)',
      }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--dc-space-3)',
          padding: 'var(--dc-space-3) var(--dc-space-4)',
          borderBottom: '1px solid var(--dc-border)',
        }}>
        <strong>Acme</strong>
        <span style={{ marginLeft: 'auto', color: 'var(--dc-fg-muted)' }}>
          Dashboard
        </span>
        <Chip variant="accent">Live</Chip>
      </div>
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--dc-space-3)',
          padding: 'var(--dc-space-4)',
        }}>
        <div
          style={{
            height: '0.9rem',
            width: '55%',
            borderRadius: 'var(--dc-radius-sm)',
            background: 'var(--dc-bg-subtle)',
          }}
        />
        <div
          style={{
            flex: 1,
            borderRadius: 'var(--dc-radius-md)',
            border: '1px solid var(--dc-border)',
            background: 'var(--dc-surface)',
          }}
        />
      </div>
    </div>
  )
}

/**
 * A single flow step for the Cases view's "Flow" exhibit. A flow component shows
 * the FlowNav stepper above the stage and fills it edge to edge; this centred
 * step card is what one stop in that sequence looks like.
 */
export function FlowStep(): ReactNode {
  return (
    <div
      style={{
        display: 'grid',
        placeItems: 'center',
        width: '100%',
        height: '100%',
        background: 'var(--dc-bg)',
      }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--dc-space-3)',
          width: '220px',
          padding: 'var(--dc-space-6)',
          border: '1px solid var(--dc-border)',
          borderRadius: 'var(--dc-radius-md)',
          background: 'var(--dc-surface)',
          fontFamily: 'var(--dc-font-sans)',
        }}>
        <span
          style={{
            fontSize: 'var(--dc-text-sm)',
            color: 'var(--dc-fg-muted)',
          }}>
          Step 1 of 3
        </span>
        <strong>Request a sign-in link</strong>
        <Button variant="accent">Send magic link</Button>
      </div>
    </div>
  )
}

/** A faithful Primer reading page — real prose and live {@link Display}
 *  specimens — for the Primer *page* exhibit (vs the skeleton template). */
export function RealPrimer(): ReactNode {
  return (
    <div className="dc-primer">
      <div className="dc-primer-inner">
        <h1>Display Case</h1>
        <p>
          The Primer is long-form wall text: a reading page that orients you in
          a design system before you browse its cases, with live specimens
          embedded inline.
        </p>
        <h2>Components</h2>
        <Display title="Button" subtitle="The quiet bordered control">
          <Button>Save changes</Button>
          <Button variant="accent">Publish</Button>
          <Button variant="ghost">Cancel</Button>
        </Display>
        <Display title="Chip" subtitle="A small status pill">
          <Chip>Default</Chip>
          <Chip variant="accent">Accent</Chip>
          <Chip variant="solid">Solid</Chip>
        </Display>
      </div>
    </div>
  )
}

/** A skeleton standing in for the Primer reading page (Primer template). */
export function PlaceholderPrimer(): ReactNode {
  const line = (w: string, h = '0.9rem') => (
    <div
      style={{
        width: w,
        height: h,
        marginBottom: '1rem',
        borderRadius: 'var(--dc-radius-sm)',
        background: 'var(--dc-bg-subtle)',
        border: '1px solid var(--dc-border)',
      }}
    />
  )
  return (
    <div className="dc-primer">
      {/* The plain block `.dc-primer-inner`. The bars use absolute widths (not
          percentages) so the inner takes its width from them — a primer of only
          percentage-width boxes has no intrinsic width and would collapse. */}
      <div className="dc-primer-inner">
        {line('14rem', '1.6rem')}
        {line('34rem')}
        {line('31rem')}
        {line('24rem')}
        <div
          style={{
            width: '34rem',
            maxWidth: '100%',
            height: '8rem',
            marginBottom: '1rem',
            borderRadius: 'var(--dc-radius-md)',
            border: '1px dashed var(--dc-border)',
          }}
        />
        {line('100%')}
        {line('84%')}
      </div>
    </div>
  )
}
