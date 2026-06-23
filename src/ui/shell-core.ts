import type {
  BrowseMode,
  Manifest,
  ManifestComponent,
  ManifestGroup,
} from '../core/manifest'
import type { HierarchyLevel } from '../index'
import { HIERARCHY_LEVELS, isSurfaceLevel } from '../index'

export type Theme = 'light' | 'dark'
/** A top-level browse mode: the Primer, the Components kit, or the Exhibits surfaces. */
export type Mode = BrowseMode

// Two ways to size the preview, à la Chrome DevTools' device toolbar:
//  - Responsive: a width (or "full"); height fills the panel; manual zoom applies.
//  - Fixed: an exact W×H (a device preset or custom); the iframe renders at that
//    size and is auto-scaled to fit the panel (manual zoom is overridden).
export interface ResponsivePreset {
  id: string
  label: string
  width: 'full' | number
}
export const RESPONSIVE: ResponsivePreset[] = [
  { id: 'full', label: 'Full', width: 'full' },
  { id: 'desktop', label: 'Desktop', width: 1280 },
  { id: 'tablet', label: 'Tablet', width: 768 },
  { id: 'mobile', label: 'Mobile', width: 375 },
]

export interface DevicePreset {
  id: string
  label: string
  w: number
  h: number
}
export const DEVICES: DevicePreset[] = [
  { id: 'tv-1080p', label: '1080p', w: 1920, h: 1080 },
  { id: 'tv-4k', label: '4K', w: 3840, h: 2160 },
  { id: 'laptop', label: 'Laptop', w: 1366, h: 768 },
  { id: 'laptop-hidpi', label: 'Laptop HiDPI', w: 1440, h: 900 },
  { id: 'ipad-pro-11', label: 'iPad Pro', w: 834, h: 1194 },
  { id: 'ipad', label: 'iPad', w: 820, h: 1180 },
  { id: 'iphone-14', label: 'iPhone 15', w: 390, h: 844 },
  { id: 'iphone-promax', label: 'iPhone Pro Max', w: 430, h: 932 },
  { id: 'iphone-se', label: 'iPhone SE', w: 375, h: 667 },
  { id: 'pixel-7', label: 'Pixel 7', w: 412, h: 915 },
  { id: 'galaxy-s20', label: 'Galaxy S20', w: 360, h: 800 },
]

export const LEVEL_LABEL: Record<HierarchyLevel | 'unclassified', string> = {
  atom: 'Atoms',
  molecule: 'Molecules',
  organism: 'Organisms',
  template: 'Templates',
  page: 'Pages',
  flow: 'Flows',
  unclassified: 'Unclassified',
}

export const GROUP_ORDER: (HierarchyLevel | 'unclassified')[] = [
  ...HIERARCHY_LEVELS,
  'unclassified',
]

// The Components mode groups only the building-block kit (atom–template) and the
// unclassified bucket; pages and flows are surfaces, organized by the Exhibits
// mode's information-architecture tree instead.
export const KIT_GROUP_ORDER: (HierarchyLevel | 'unclassified')[] = [
  'atom',
  'molecule',
  'organism',
  'template',
  'unclassified',
]

// At or below this chrome width the nav starts collapsed (tablet and down).
export const NAV_COLLAPSE_MAX = 1024

export const ZOOM_MIN = 0.5
export const ZOOM_MAX = 2
export const ZOOM_STEP = 0.1

// Documentation panel width (px), adjustable by dragging its left edge.
export const DOC_MIN_W = 256
export const DOC_MAX_W = 640
export const DOC_DEFAULT_W = 352 // 22rem

// Sidebar (nav rail) width (px), adjustable by dragging its right edge. The
// minimum is the default 15rem (it can also collapse entirely via the ☰ toggle);
// the maximum keeps it from squeezing the stage and docs panel. The chosen width
// is remembered across sessions (localStorage).
export const SIDEBAR_MIN_W = 240 // 15rem — matches --dc-sidebar-w
export const SIDEBAR_MAX_W = 480 // 30rem
export const SIDEBAR_STORAGE_KEY = 'dc-sidebar-w'

// Stage crossfade duration (ms): the exhibit fades out when the selection
// changes, swaps while hidden, then fades back in once measured. Mirrors the
// CSS opacity transition on the stage.
export const STAGE_FADE_MS = 150

// Primer ↔ Cases crossfade duration (ms): on a mode switch the nav, the screen
// content, and the mode-specific header controls all fade out together, the view
// swaps while hidden, then everything fades back in. The mode-switch highlight
// box lerps across this same span (see `.dc-modeswitch-thumb`). Mirrors the CSS
// opacity transitions applied to those regions.
export const MODE_FADE_MS = 200

// The stage's dotted-grid margin around a decorated component, in px. It scales
// with the spare room — from 1 grid cell when the component is near max width up
// to 3 cells when there's plenty — and is snapped to the grid so the component's
// edges land on dot columns/rows. `GRID` is the dot spacing (matches the 16px
// `background-size` of `.dc-stage-frame`'s grid in chrome.css).
export const GRID = 16
export const MIN_PAD = GRID // at least 1 dot
export const MAX_PAD = GRID * 3 // at most 3 dots

// Center-fit, grid-snapped padding for one axis: half the spare space (after the
// 1px borders), floored to a whole number of dots, clamped to [MIN_PAD, MAX_PAD].
export function gridPad(available: number, box: number): number {
  const slack = Math.floor((available - box - 2) / 2 / GRID) * GRID
  return Math.max(MIN_PAD, Math.min(MAX_PAD, slack))
}

export interface Selection {
  componentId: string
  caseId: string
  tweaks: Record<string, string>
}

export interface ParsedRoute {
  componentId: string
  caseId: string
  tweaks: Record<string, string>
  docs: boolean
  /** The pathname this route was parsed from, for mode resolution. */
  path: string
}

/**
 * Pure route parse from an explicit path + query string. Usable on the server —
 * which has only the request, not `window` — and on the client, so the shell's
 * server render and its client hydration derive the same initial route and agree.
 */
export function parseRoute(pathname: string, search: string): ParsedRoute {
  const parts = pathname.split('/').filter(Boolean)
  const tweaks: Record<string, string> = {}
  const params = new URLSearchParams(search)
  for (const [k, v] of params) {
    if (k.startsWith('t.')) tweaks[k.slice(2)] = v
  }
  return {
    componentId: parts[1] ?? '',
    caseId: parts[2] ?? '',
    tweaks,
    docs: params.get('docs') === '1',
    path: pathname,
  }
}

/** Client convenience: parse the live address. Reads `window`, so client-only. */
export function parseLocation(): ParsedRoute {
  return parseRoute(window.location.pathname, window.location.search)
}

/**
 * Resolve a route to its browse mode. The mode is the path prefix: `/primer` is
 * the Primer, `/e/...` an Exhibits (surface) case, `/c/...` a Components (kit)
 * case; the bare `/` honors `manifest.landing`. A mode that is not present falls
 * back to the resolved landing mode. Pure (takes the route), so it runs on the
 * server and the client identically.
 */
export function resolveMode(route: ParsedRoute, m: Manifest): Mode {
  const has = (mode: Mode) => m.modes.includes(mode)
  const p = route.path
  if (p === '/primer' && has('primer')) return 'primer'
  if ((p === '/e' || p.startsWith('/e/')) && has('exhibits')) return 'exhibits'
  if ((p === '/c' || p.startsWith('/c/')) && has('components'))
    return 'components'
  return m.landing
}

/** Client convenience over {@link resolveMode}. Reads `window`; client-only. */
export function primerForLocation(m: Manifest): boolean {
  return resolveMode(parseLocation(), m) === 'primer'
}

/** Pure initial selection from a parsed route + manifest (server + client). With
 *  no case in the route, pick the first component of the landing mode's kind —
 *  the first surface for Exhibits, otherwise the first kit component — so the
 *  stage seeds the right side of the catalog. */
export function initialSelectionFor(
  m: Manifest,
  route: ParsedRoute,
): Selection {
  if (route.componentId)
    return {
      componentId: route.componentId,
      caseId: route.caseId,
      tweaks: route.tweaks,
    }
  const mode = resolveMode(route, m)
  const wantSurface = mode === 'exhibits'
  const first =
    m.components.find((c) => isSurfaceLevel(c.level) === wantSurface) ??
    m.components[0]
  if (first) {
    return {
      componentId: first.id,
      caseId: first.cases[0]?.id ?? '',
      tweaks: {},
    }
  }
  return { componentId: '', caseId: '', tweaks: {} }
}

/** Client convenience over {@link initialSelectionFor}. Reads `window`. */
export function initialSelection(m: Manifest): Selection {
  return initialSelectionFor(m, parseLocation())
}

// Identity of a selection: component + case + tweak overrides. Drives the
// reveal gate (a size report only counts once it matches the shown selection,
// tweaks included) and detects when a selection change is a no-op. Note: a
// tweak-only change alters this signature but is NOT a crossfade trigger — the
// crossfade controller compares component+case, so the frame retweaks in place.
export function selSignature(s: Selection): string {
  return `${s.componentId}\0${s.caseId}\0${JSON.stringify(s.tweaks ?? {})}`
}

// Encode the shareable app address: which case is on the stage, its tweak
// overrides (`t.*`), and whether the docs panel is open (`docs=1`). Parsed back
// on load by `parseLocation` so any of these survive a copied/shared link.
export function buildUrl(
  componentId: string,
  caseId: string,
  tweaks: Record<string, string>,
  docsOpen: boolean,
  isSurface = false,
): string {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(tweaks)) params.set(`t.${k}`, v)
  if (docsOpen) params.set('docs', '1')
  const qs = params.toString()
  // The mode is the path prefix: `/e/` for an Exhibits surface, `/c/` for a
  // Components (kit) case — so a deep link carries its mode.
  const prefix = isSurface ? 'e' : 'c'
  return `/${prefix}/${componentId}/${caseId}${qs ? `?${qs}` : ''}`
}

export function buildRenderSrc(
  renderUrl: string,
  theme: Theme,
  tweaks: Record<string, string>,
  fit: boolean,
  transparent: boolean,
): string {
  const params = new URLSearchParams()
  params.set('theme', theme)
  // The preview's pixel size is controlled by the iframe element, not an inner
  // max-width, so the frame always renders "full".
  for (const [k, v] of Object.entries(tweaks)) params.set(`t.${k}`, v)
  // `fit` asks the render frame to shrink-wrap the case to its natural width so
  // a small component (e.g. a square button) doesn't stretch to fill the frame.
  if (fit) params.set('fit', '1')
  // `transparent` drops the render doc's background so the component sits on the
  // stage's dotted grid (decorated components only — not pages/flows, and not
  // the standalone /render endpoint, which keeps its opaque snapshot bg).
  if (transparent) params.set('transparent', '1')
  return `${renderUrl}?${params.toString()}`
}

// The shareable standalone-snapshot address shown above the stage: the render
// URL with the visible theme and any tweak overrides — none of the
// stage-internal `fit`/`transparent` hints `buildRenderSrc` adds, since those
// describe how the vitrine embeds the frame, not the case a reader would open.
// Absolute (origin-prefixed) so the address a reader copies pastes straight into
// a browser; `renderUrl` is a server-relative path like `/render/...`. `origin`
// is passed in (not read from `window`) so this stays pure: the server and the
// client's first render both use an empty origin (a relative URL), and the
// client fills the real origin in after hydration — no hydration mismatch.
export function buildAddressUrl(
  renderUrl: string,
  theme: Theme,
  tweaks: Record<string, string>,
  origin: string,
): string {
  const params = new URLSearchParams()
  params.set('theme', theme)
  for (const [k, v] of Object.entries(tweaks)) params.set(`t.${k}`, v)
  return `${origin}${renderUrl}?${params.toString()}`
}

// Components mode: group the building-block kit by level (atom → template, then
// unclassified). Surfaces (page/flow) are excluded — they live in the Exhibits
// mode — and never match a kit key anyway.
export function groupByLevel(components: ManifestComponent[]) {
  return KIT_GROUP_ORDER.map((key) => ({
    key,
    components: components.filter(
      (c) => !isSurfaceLevel(c.level) && (c.level ?? 'unclassified') === key,
    ),
  })).filter((g) => g.components.length > 0)
}

// A node of the Exhibits-mode navigation tree: a group with its surfaces and
// nested child groups. Mirrors the manifest group tree, with the surfaces that
// resolve to each group attached.
export interface ExhibitNode {
  label: string
  path: string[]
  collapsed: boolean
  children: ExhibitNode[]
  components: ManifestComponent[]
}

// Build the Exhibits view: surfaces in the default group (no path) listed first,
// then the manifest's ordered group tree with each group's surfaces attached.
export function buildExhibitView(m: Manifest): {
  ungrouped: ManifestComponent[]
  tree: ExhibitNode[]
} {
  const surfaces = m.components.filter((c) => isSurfaceLevel(c.level))
  const byKey = new Map<string, ManifestComponent[]>()
  const ungrouped: ManifestComponent[] = []
  for (const c of surfaces) {
    if (!c.group || c.group.length === 0) {
      ungrouped.push(c)
      continue
    }
    const key = c.group.join('/').toLowerCase()
    const arr = byKey.get(key)
    if (arr) arr.push(c)
    else byKey.set(key, [c])
  }
  const toNode = (g: ManifestGroup): ExhibitNode => ({
    label: g.label,
    path: g.path,
    collapsed: g.collapsed,
    children: g.children.map(toNode),
    components: byKey.get(g.path.join('/').toLowerCase()) ?? [],
  })
  return { ungrouped, tree: m.groups.map(toNode) }
}

/** Case-insensitive substring match for the sidebar filter. */
export function matchesFilter(text: string, filter: string): boolean {
  const f = filter.trim().toLowerCase()
  return f === '' || text.toLowerCase().includes(f)
}

/** Whether any of a component's identifiers (its name, any case name, or a group
 *  segment) match the filter — so a filtered tree keeps a component reachable by
 *  its own name, a case name, or its group. */
export function componentMatchesFilter(
  c: ManifestComponent,
  filter: string,
): boolean {
  if (matchesFilter(c.name, filter)) return true
  if (c.cases.some((cs) => matchesFilter(cs.name, filter))) return true
  return c.group.some((seg) => matchesFilter(seg, filter))
}

// A `##`-heading group in the primer table of contents: the heading plus the
// Displays that follow it (a leading headless group holds Displays before the
// first heading).
export interface PrimerSection {
  id: string
  title: string
  kind: 'heading' | 'display'
}
export interface PrimerGroup {
  heading: PrimerSection | null
  items: PrimerSection[]
}

// Fold the primer's flat, document-ordered section list into `##`-heading
// groups: each heading owns the Displays that follow it. Displays before the
// first heading (e.g. the wordmark under the H1) sit in a leading headless
// group so they still appear in the table of contents.
export function groupPrimerSections(
  primerSections: PrimerSection[],
): PrimerGroup[] {
  const out: PrimerGroup[] = []
  let current: PrimerGroup | null = null
  for (const s of primerSections) {
    if (s.kind === 'heading') {
      current = { heading: s, items: [] }
      out.push(current)
    } else {
      if (!current) {
        current = { heading: null, items: [] }
        out.push(current)
      }
      current.items.push(s)
    }
  }
  return out
}
