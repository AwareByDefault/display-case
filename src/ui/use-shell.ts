import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  RefCallback,
} from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Manifest, ManifestComponent } from '../core/manifest'
import type { A11yViolation } from '../index'
import { isSurfaceLevel } from '../index'
import {
  buildAddressUrl,
  buildExhibitView,
  buildRenderSrc,
  buildUrl,
  DEVICES,
  DOC_DEFAULT_W,
  DOC_MAX_W,
  DOC_MIN_W,
  type ExhibitNode,
  GRID,
  gridPad,
  groupByLevel,
  groupPrimerSections,
  initialSelectionFor,
  MIN_PAD,
  MODE_FADE_MS,
  type Mode,
  NAV_COLLAPSE_MAX,
  NAV_DRAWER_MAX,
  type ParsedRoute,
  type PrimerGroup,
  type PrimerSection,
  parseLocation,
  RESPONSIVE,
  resolveMode,
  type Selection,
  SIDEBAR_MAX_W,
  SIDEBAR_MIN_W,
  SIDEBAR_STORAGE_KEY,
  STAGE_FADE_MS,
  selSignature,
  type Theme,
} from './shell-core'
import { DcTestIds } from './test-ids'

/** The accessibility audit results the chrome surfaces — per-variant nav markers
 *  across the library plus the active variant's verdict. The whole field is only
 *  present when a11y scanning is configured; when it's absent the chrome shows no
 *  markers and no panel at all (see {@link ShellViewModel.a11y}). */
export interface A11ySurface {
  /** componentId → (caseId → that variant's WCAG violation count). Violations
   *  belong to a *variant* (each `/render/<component>/<case>` is audited on its
   *  own), so this is keyed per case. The nav rail folds it: a collapsed
   *  component shows the sum across its variants; expanded, the per-variant
   *  counts move onto the case rows and the parent shows a plain marker.
   *  Absent components / all-zero variants render no marker. A still-scanning
   *  case simply has no entry yet (its marker appears once the scan lands). */
  byVariant: Record<string, Record<string, number>>
  /** The active variant's verdict for the stage panel: `'pending'` while its
   *  scan is in flight, `'unavailable'` when the scan prerequisite can't run, an
   *  empty array for a clean pass, or the violations.
   *  (There is no "not audited" value — the panel only renders when a11y is
   *  configured, and a configured, viewed variant is always pending-or-resolved.) */
  current: A11yViolation[] | 'pending' | 'unavailable'
  /** How the resolved verdict should animate in: `'cascade'` when it just
   *  resolved from a live scan (the user watched "Scanning…"), `'all'` when it
   *  came straight from cache (already scanned — fade in at once). */
  reveal?: 'cascade' | 'all'
}

// The view model the chrome's pure {@link ShellView} renders. Everything the
// chrome needs to draw a frame is here — state, derived layout numbers, event
// handlers and the imperative refs the live iframes attach to. `useShell`
// produces the live one (state + effects + the render-frame handshake); a case
// can hand-build a static one to exhibit the chrome as a page/flow.
export interface ShellViewModel {
  manifest: Manifest
  theme: Theme
  setTheme: (update: (t: Theme) => Theme) => void
  navCollapsed: boolean
  setNavCollapsed: (update: (c: boolean) => boolean) => void
  /** Sidebar (nav rail) width in px — drag its right edge to resize; remembered
   *  across sessions. Applied as the `--dc-sidebar-w` grid column. */
  sidebarWidth: number
  startSidebarResize: (e: ReactPointerEvent<HTMLDivElement>) => void
  onSidebarResizeKey: (e: ReactKeyboardEvent<HTMLDivElement>) => void

  // Browse mode: Primer · Components · Exhibits.
  mode: Mode
  setMode: (m: Mode) => void
  shownMode: Mode
  modeFadeStyle: CSSProperties

  // Device toolbar / zoom / grid.
  sizeId: string
  setSizeId: (id: string) => void
  manualZoom: number
  setManualZoom: (update: (z: number) => number) => void
  showGrid: boolean
  setShowGrid: (update: (g: boolean) => boolean) => void
  widthInputValue: number | ''
  fixed: { w: number; h: number } | null
  fitted: boolean
  scale: number
  sizeMeta: string
  editDim: (axis: 'w' | 'h', raw: string) => void
  rotateDims: () => void

  // The exhibit on the stage.
  stageDecor: boolean
  component: ManifestComponent | null
  activeCase: ManifestComponent['cases'][number] | null
  shownSel: Selection | null
  sel: Selection | null
  /** The exhibit's shareable standalone-snapshot address (origin-prefixed). Held
   *  on the model — not derived in the view — so the pure view never reads
   *  `window`, and an exhibit can supply a deterministic address. */
  addressUrl: string

  // Docs panel.
  docOpen: boolean
  changeDocsOpen: (open: boolean) => void
  docText: string | null
  docWidth: number
  startDocResize: (e: ReactPointerEvent<HTMLDivElement>) => void
  onDocResizeKey: (e: ReactKeyboardEvent<HTMLDivElement>) => void

  // Tweaks panel.
  tweaksFloating: boolean
  setTweaksFloating: (update: (f: boolean) => boolean) => void

  // Accessibility audit surface. Optional — absent until live audits are wired
  // into the running chrome; a page/template exhibit supplies it to demonstrate
  // the surfacing. `byVariant` drives the nav-rail markers (a component is
  // discoverable as having issues without selecting it — summed when collapsed
  // or a single-case leaf, per-variant when expanded); `current` lists the
  // active variant's violations in the stage's a11y panel.
  a11y?: A11ySurface
  /** Force a fresh audit of the viewed variant (the panel's "re-scan" control).
   *  Absent in a static exhibit unless it wires its own. */
  rescanA11y?: () => void

  // Nav rail (scroll-fade refs + library tree).
  navScrollRef: RefCallback<HTMLDivElement> | { current: HTMLDivElement | null }
  navBodyRef: RefCallback<HTMLDivElement> | { current: HTMLDivElement | null }
  /** Components mode: the kit grouped by level. */
  groups: ReturnType<typeof groupByLevel>
  /** Exhibits mode: ungrouped surfaces + the nested IA group tree. */
  exhibitView: { ungrouped: ManifestComponent[]; tree: ExhibitNode[] }
  /** Sidebar filter text (both catalog modes); empty = no filter. */
  filter: string
  setFilter: (s: string) => void
  /** The active surface's group path, for the Exhibits-mode stage breadcrumb;
   *  empty for a kit component or a default-group surface. */
  breadcrumb: string[]
  expanded: Set<string>
  toggleExpanded: (id: string) => void
  selectComponent: (c: ManifestComponent) => void
  select: (next: Selection) => void

  // Nav rail (primer table of contents).
  primerGroups: PrimerGroup[]
  primerActive: string
  primerExpanded: Set<string>
  togglePrimerGroup: (id: string) => void
  scrollToSection: (id: string) => void

  // Stage geometry.
  attachPreview: RefCallback<HTMLDivElement>
  padX: number
  padY: number
  stageShown: boolean
  /** True for the duration of a navigation crossfade (fade-out through fade-in).
   *  The a11y panel uses it to hard-switch its verdict colour while faded rather
   *  than easing the previous exhibit's colour across the fade. */
  colorSnap?: boolean
  boxW: number
  boxH: number

  // Live-frame plumbing (the container builds the iframes from these; a case
  // ignores them and supplies a static stage/primer slot instead).
  frameRef: { current: HTMLIFrameElement | null }
  frameSrc: string | null
  targetW: number
  renderH: number
  primerRef: { current: HTMLIFrameElement | null }
  primerSrc: string | null
}

/**
 * The browse chrome's state machine: manifest loading, the address ↔ selection
 * sync, the stage crossfade + sizing math, the docs panel, and the render/
 * primer frame handshakes. It owns every hook so {@link ShellView} can stay a
 * pure function of the {@link ShellViewModel} it returns — which is also what
 * lets the chrome be exhibited as a page/flow from a static, hand-built model.
 *
 * The shell is seeded: the server renders it from the in-memory manifest + the
 * request route + theme, and the client hydrates from the same seed (the inlined
 * manifest + the live address), so the render-affecting initial state is
 * deterministic on both sides. Measured values (panel/content size, frame src)
 * start at constants and update in effects after hydration.
 */
export interface ShellSeed {
  manifest: Manifest
  route: ParsedRoute
  theme: Theme
  /** Whether live a11y surfacing is configured (drives nav markers + panel). */
  a11y: boolean
}

export function useShell(seed: ShellSeed): ShellViewModel | { manifest: null } {
  // Initial selection + mode are derived from the seed (route + manifest), not
  // from `window`, so the server render and the client hydration agree.
  const seedSel = initialSelectionFor(seed.manifest, seed.route)
  const seedMode = resolveMode(seed.route, seed.manifest)
  const [manifest, setManifest] = useState<Manifest | null>(seed.manifest)
  // Read in the popstate listener (a `[]`-deps effect) to decide whether `/`
  // means the Primer — without resubscribing the listener on every manifest change.
  const manifestRef = useRef(manifest)
  manifestRef.current = manifest
  // Whether a component id is a surface (page/flow) — picks the `/e/` vs `/c/`
  // URL prefix. Reads the manifest ref so it needs no deps.
  const isSurfaceId = useCallback((componentId: string): boolean => {
    const m = manifestRef.current
    return isSurfaceLevel(
      m?.components.find((c) => c.id === componentId)?.level,
    )
  }, [])
  const [sel, setSel] = useState<Selection | null>(seedSel)
  const [theme, setTheme] = useState<Theme>(seed.theme)
  // Page origin for absolute shareable addresses. Empty during the server render
  // and the client's first render (so they match); filled in after hydration.
  const [origin, setOrigin] = useState('')
  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  // Live accessibility surfacing. Whether scanning is configured is part of the
  // seed (the server knows; the client gets the same value inlined), so the
  // markers/panel render identically on both sides. Results come from `/a11y`
  // (per viewed variant) and are pushed in over the SSE stream as scans complete.
  const dcConfig = (
    globalThis as {
      __displayCase?: { reload?: boolean; a11y?: boolean; dev?: boolean }
    }
  ).__displayCase
  const a11yEnabled = seed.a11y
  const [a11y, setA11y] = useState<A11ySurface | undefined>(
    a11yEnabled ? { byVariant: {}, current: 'pending' } : undefined,
  )
  // The variant the panel currently reflects, so a late-arriving scan for a
  // variant the viewer has since left updates only the nav markers, not the panel.
  const a11yCurRef = useRef<{ c?: string; cs?: string; th?: string }>({})

  const applyA11yResult = useCallback(
    (
      c: string,
      cs: string,
      th: string,
      res: {
        status: 'ok' | 'pending' | 'unavailable'
        violations?: A11yViolation[]
        reason?: string
      },
      // True when this result came from a live scan completing (the SSE push),
      // false when it came straight from the cache (the fetch response).
      fromScan: boolean,
    ) => {
      setA11y((prev) => {
        const byVariant = { ...(prev?.byVariant ?? {}) }
        if (res.status === 'ok') {
          byVariant[c] = {
            ...(byVariant[c] ?? {}),
            [cs]: res.violations?.length ?? 0,
          }
        }
        const cur = a11yCurRef.current
        const isCurrent = c === cur.c && cs === cur.cs && th === cur.th
        let current = prev?.current ?? 'pending'
        let reveal = prev?.reveal ?? 'all'
        if (isCurrent) {
          if (res.status === 'ok') {
            current = res.violations ?? []
            // Cascade only when the user watched it scan; a cache hit fades in.
            reveal = fromScan ? 'cascade' : 'all'
          } else current = res.status
        }
        return { byVariant, current, reveal }
      })
    },
    [],
  )

  const requestA11y = useCallback(
    (c: string, cs: string, th: string, force?: boolean) => {
      a11yCurRef.current = { c, cs, th }
      // A forced re-scan always runs a real scan, so show "Scanning…" at once.
      // A plain view lets the response decide: a cache hit resolves straight to
      // the result (faded in), only a real scan shows "Scanning…" then cascades.
      if (force) {
        setA11y((prev) => ({
          byVariant: prev?.byVariant ?? {},
          current: 'pending',
          reveal: prev?.reveal ?? 'all',
        }))
      }
      const rescan = force ? '&rescan=1' : ''
      fetch(
        `/a11y?component=${encodeURIComponent(c)}&case=${encodeURIComponent(cs)}&theme=${th}${rescan}`,
      )
        .then((r) => r.json())
        .then((res) => applyA11yResult(c, cs, th, res, false))
        .catch(() => {})
    },
    [applyA11yResult],
  )

  // The panel's "re-scan" affordance: force a fresh audit of the viewed variant.
  const rescanA11y = useCallback(() => {
    const cur = a11yCurRef.current
    if (cur.c && cur.cs && cur.th) requestA11y(cur.c, cur.cs, cur.th, true)
  }, [requestA11y])
  // Selected size: a responsive/device preset id, or 'custom' (uses `custom`).
  const [sizeId, setSizeId] = useState<string>('full')
  const [custom, setCustom] = useState<{ w: number; h: number }>({
    w: 1280,
    h: 800,
  })
  const [manualZoom, setManualZoom] = useState(1)
  // Stage backdrop for decorated components: the dotted grid (default) or the
  // consumer app's own background colour (`--color-bg`, the same the iframe uses).
  const [showGrid, setShowGrid] = useState(true)
  // Measured inner size of the preview panel, for fit-to-panel scaling.
  const [panel, setPanel] = useState<{ w: number; h: number }>({
    w: 0,
    h: 0,
  })
  const previewObserver = useRef<ResizeObserver | null>(null)
  // Natural size of the rendered component, reported by the render frame. In
  // Responsive mode a decorated component is sized to its own height (and
  // centered on the grid) instead of stretching to fill the panel.
  const [content, setContent] = useState<{ w: number; h: number } | null>(null)
  // The selection the stage currently *displays*. It trails `sel` by one
  // fade-out so the iframe content, size, and mode all swap while the stage is
  // hidden — a clean crossfade rather than a mid-flight jump. The sidebar tracks
  // `sel` directly (instant highlight); only the exhibit waits.
  const [shownSel, setShownSel] = useState<Selection | null>(seedSel)
  const shownSelRef = useRef(shownSel)
  shownSelRef.current = shownSel
  const selRef = useRef(sel)
  selRef.current = sel
  const selSig = sel ? selSignature(sel) : ''
  // Drives the stage opacity. Starts hidden so the first exhibit fades in once
  // measured; flipped false on navigation (fade out) and true once the shown
  // exhibit has caught up and reported its size (fade in).
  const [stageShown, setStageShown] = useState(false)
  // True while a navigation crossfade is in flight (fade-out start → fade-in
  // end). The a11y panel snaps its verdict colour during this window so the new
  // exhibit's colour is in place before it fades in, instead of easing the old
  // colour across the fade.
  const [colorSnap, setColorSnap] = useState(true)
  // Signature of the exhibit the render frame last reported a size for. The
  // stage only fades in once this matches what's shown, so a swap never reveals
  // at the wrong size.
  const [measuredSig, setMeasuredSig] = useState('')
  const [docOpen, setDocOpen] = useState(seed.route.docs)
  // Kept current so the stable `select` callback can preserve the docs flag in
  // the address across navigations without taking `docOpen` as a dependency.
  const docOpenRef = useRef(docOpen)
  docOpenRef.current = docOpen
  const [docText, setDocText] = useState<string | null>(null)
  const [docWidth, setDocWidth] = useState(DOC_DEFAULT_W)
  // Tweaks panel can be undocked into a free-floating, draggable overlay.
  const [tweaksFloating, setTweaksFloating] = useState(false)
  // Starts expanded deterministically (the server has no viewport width); an
  // effect collapses it on a narrow viewport after mount, so hydration matches.
  const [navCollapsed, setNavCollapsed] = useState(false)
  // Sidebar width. Seeded to the minimum so the server render and the client's
  // first render agree (the CSS default is the same 15rem); a mount effect then
  // applies any width remembered from a previous session.
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_MIN_W)
  // Which components are expanded in the nav. Collapsed by default; the
  // initially-selected component is seeded open so its active case is visible.
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(seedSel.componentId ? [seedSel.componentId] : []),
  )
  const frameRef = useRef<HTMLIFrameElement | null>(null)
  // The iframe loads once at a fixed src; every later change (case, theme,
  // width, tweaks) is pushed in via postMessage so it never reloads/flickers.
  const [frameSrc, setFrameSrc] = useState<string | null>(null)
  const [frameReady, setFrameReady] = useState(false)

  // ── Primer (the optional .mdx reading page) ──────────────────────────────
  // Which sidebar view is active. The Primer, when configured, is the default
  // landing view (it orients you before you browse) — but a deep link to a case
  // opens straight into the library.
  const [mode, setMode] = useState<Mode>(seedMode)
  // Sidebar filter text, shared by the Components and Exhibits modes.
  const [filter, setFilter] = useState('')
  // The mode actually on screen. `mode` is the target (drives the mode-switch
  // highlight box, which lerps to it instantly); `shownMode` lags by one fade so
  // the nav, screen content, and header controls swap while hidden — a crossfade
  // rather than a hard cut. Mirrors the `sel`/`shownSel` stage pattern above.
  const [shownMode, setShownMode] = useState<Mode>(seedMode)
  const shownModeRef = useRef(shownMode)
  shownModeRef.current = shownMode
  // Drives the opacity of the faded regions: true = shown, false = mid-swap.
  const [modeContentShown, setModeContentShown] = useState(true)
  // The nav scroll region — an inner wrapper, so the rail's right border (on the
  // outer nav) and the pinned mode switch above it are never faded. Its native
  // scrollbar is hidden (see chrome.css); a soft gradient fade at whichever edge
  // has more content off-screen is the affordance instead. `data-fade-top` /
  // `data-fade-bottom` toggle the mask; this recomputes them from scroll position.
  const navScrollRef = useRef<HTMLDivElement | null>(null)
  const navBodyRef = useRef<HTMLDivElement | null>(null)
  const updateNavFade = useCallback(() => {
    const el = navScrollRef.current
    if (!el) return
    const max = el.scrollHeight - el.clientHeight
    const T = 4 // px slack so a resting top/bottom reads as fully docked
    el.setAttribute('data-fade-top', el.scrollTop > T ? 'true' : 'false')
    el.setAttribute(
      'data-fade-bottom',
      el.scrollTop < max - T ? 'true' : 'false',
    )
  }, [])
  // The Primer renders in its own isolated iframe (like /render), created lazily
  // the first time the Primer view is opened.
  const primerRef = useRef<HTMLIFrameElement | null>(null)
  const [primerSrc, setPrimerSrc] = useState<string | null>(null)
  const [primerReady, setPrimerReady] = useState(false)
  // Section table-of-contents + active section, reported by the Primer frame.
  const [primerSections, setPrimerSections] = useState<PrimerSection[]>([])
  const [primerActive, setPrimerActive] = useState('')
  // Heading ids the reader has expanded in the table of contents. Tracking the
  // open set (not the closed one) makes groups collapsed by default — the ids
  // arrive asynchronously, so there's nothing to pre-seed a "collapsed" set with.
  const [primerExpanded, setPrimerExpanded] = useState<Set<string>>(
    () => new Set(),
  )
  // Accordion: at most one TOC group is open. Expanding a group collapses any
  // other; clicking the open group's chevron closes it (leaving all closed).
  const togglePrimerGroup = useCallback((id: string) => {
    setPrimerExpanded((prev) => (prev.has(id) ? new Set() : new Set([id])))
  }, [])

  // The manifest, selection, and mode are seeded at init (the server renders from
  // them and the client hydrates from the same seed), so there is no initial
  // fetch here. The live-reload refresh below still refetches `/manifest.json` to
  // pick up catalog changes without a full reload.
  //
  // Collapse the nav on a narrow viewport once mounted. It starts expanded (the
  // server has no viewport width); collapsing in an effect runs only on the
  // client, after hydration, so the first render matches on both sides.
  useEffect(() => {
    if (window.innerWidth <= NAV_COLLAPSE_MAX) setNavCollapsed(true)
  }, [])

  // Restore the remembered sidebar width on the client, after hydration (the
  // server can't read localStorage, so the first render uses the default).
  useEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem(SIDEBAR_STORAGE_KEY))
      if (saved)
        setSidebarWidth(Math.max(SIDEBAR_MIN_W, Math.min(SIDEBAR_MAX_W, saved)))
    } catch {
      // Storage unavailable (private mode, etc.) — keep the default.
    }
  }, [])

  // Crossfade the chrome when the view mode changes. The highlight box lerps to
  // `mode` immediately (CSS); everything that swaps content — nav, screen, the
  // mode-specific header controls — fades out first, swaps `shownMode` while
  // hidden, then fades back in (two rAFs so the swapped-in view paints at opacity
  // 0 before the transition to 1). Keyed on `mode` only; `shownMode` is read
  // through a ref so a rapid toggle-back mid-fade just fades the current view
  // back in (the pending swap is cancelled) instead of restarting.
  useEffect(() => {
    if (mode === shownModeRef.current) {
      setModeContentShown(true)
      return
    }
    setModeContentShown(false) // fade out
    let raf1 = 0
    let raf2 = 0
    const swap = setTimeout(() => {
      setShownMode(mode) // swap while hidden
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setModeContentShown(true)) // fade in
      })
    }, MODE_FADE_MS)
    return () => {
      clearTimeout(swap)
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
    }
  }, [mode])

  // Keep the nav's scroll-fade in sync: on scroll, when the container is resized
  // (the sidebar's height tracks the window), and when its content height changes
  // — expand/collapse, a mode swap, the primer TOC loading — which a
  // ResizeObserver on the content body catches without listing state deps.
  useEffect(() => {
    // Gate on `manifest`: until it loads, the chrome renders a loading screen and
    // the nav isn't mounted, so re-run once it is (the ref is null before then).
    if (!manifest) return
    const el = navScrollRef.current
    if (!el) return
    updateNavFade()
    el.addEventListener('scroll', updateNavFade, { passive: true })
    const ro = new ResizeObserver(updateNavFade)
    ro.observe(el)
    if (navBodyRef.current) ro.observe(navBodyRef.current)
    return () => {
      el.removeEventListener('scroll', updateNavFade)
      ro.disconnect()
    }
  }, [manifest, updateNavFade])

  // Lazily mount the Primer frame the first time its view is opened, seeding the
  // theme into the URL so the initial paint is correct; later theme changes are
  // pushed in via postMessage (below) so it never reloads.
  useEffect(() => {
    if (mode === 'primer' && !primerSrc) {
      setPrimerSrc(`/render/primer?theme=${theme}`)
    }
  }, [mode, primerSrc, theme])

  // Receive the Primer frame's section list, active section, and readiness.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== primerRef.current?.contentWindow) return
      const data = e.data as {
        type?: string
        sections?: PrimerSection[]
        id?: string
      }
      if (data?.type === 'dc-primer-ready') setPrimerReady(true)
      else if (data?.type === 'dc-primer-sections' && data.sections)
        setPrimerSections(data.sections)
      else if (data?.type === 'dc-primer-active' && data.id)
        setPrimerActive(data.id)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  // Keep the Primer frame's theme in step with the chrome's.
  useEffect(() => {
    if (!primerReady) return
    primerRef.current?.contentWindow?.postMessage(
      { type: 'dc-primer-theme', theme },
      '*',
    )
  }, [theme, primerReady])

  // Scroll the Primer to a section when its TOC entry is clicked. Setting the
  // active section immediately drives the accordion (see the effect below) so
  // the clicked group opens without waiting for the scroll to settle.
  const scrollToSection = useCallback((id: string) => {
    setPrimerActive(id)
    primerRef.current?.contentWindow?.postMessage(
      { type: 'dc-primer-scroll', id },
      '*',
    )
  }, [])

  const select = useCallback(
    (next: Selection) => {
      setSel(next)
      // On a phone the open nav is a full-width drawer over the stage; close it
      // once a case is chosen so the selection is visible.
      if (window.innerWidth <= NAV_DRAWER_MAX) setNavCollapsed(true)
      window.history.pushState(
        null,
        '',
        buildUrl(
          next.componentId,
          next.caseId,
          next.tweaks,
          docOpenRef.current,
          isSurfaceId(next.componentId),
        ),
      )
    },
    [isSurfaceId],
  )

  // Switch browse mode, reflecting it in the address so the boundary is a real
  // navigation step (back/forward cross it; a copied link reopens the view). The
  // Primer is `/primer`. A catalog mode reuses the current selection when it
  // already belongs to that mode (so toggling back returns you to where you
  // were), else jumps to the first component of the mode's kind — Exhibits to the
  // first surface, Components to the first kit component. `setMode` runs the
  // crossfade; changing `sel` swaps the stage behind it.
  const changeMode = useCallback(
    (m: Mode) => {
      setMode(m)
      if (m === 'primer') {
        window.history.pushState(null, '', '/primer')
        return
      }
      const wantSurface = m === 'exhibits'
      const cur = selRef.current
      let target =
        cur && isSurfaceId(cur.componentId) === wantSurface ? cur : null
      if (!target) {
        const first = manifestRef.current?.components.find(
          (c) => isSurfaceLevel(c.level) === wantSurface,
        )
        if (first)
          target = {
            componentId: first.id,
            caseId: first.cases[0]?.id ?? '',
            tweaks: {},
          }
      }
      if (target) {
        setSel(target)
        window.history.pushState(
          null,
          '',
          buildUrl(
            target.componentId,
            target.caseId,
            target.tweaks,
            docOpenRef.current,
            wantSurface,
          ),
        )
      } else {
        window.history.pushState(null, '', wantSurface ? '/e' : '/c')
      }
    },
    [isSurfaceId],
  )

  // Open/close the docs panel and reflect it in the address (replaceState, so a
  // toggle isn't a back-button step) so the open panel is deep-linkable.
  const changeDocsOpen = useCallback(
    (open: boolean) => {
      setDocOpen(open)
      if (!sel) return
      window.history.replaceState(
        null,
        '',
        buildUrl(
          sel.componentId,
          sel.caseId,
          sel.tweaks,
          open,
          isSurfaceId(sel.componentId),
        ),
      )
    },
    [sel, isSurfaceId],
  )

  // Browser back/forward only changes the address; this is the read side that
  // applies it back to state. `select`/`changeDocsOpen` are the write side
  // (they pushState/replaceState), so here we set state directly — never push a
  // new entry, or back/forward would fight history.
  useEffect(() => {
    const onPop = () => {
      const loc = parseLocation()
      // A case address (`/c/...` or `/e/...`) updates the stage selection; the
      // mode is read from the address (the path prefix), so back/forward across a
      // mode boundary restores the right view. A non-case address (`/primer`,
      // `/`) leaves `sel` untouched so a later toggle back restores it.
      if (loc.componentId) {
        setSel({
          componentId: loc.componentId,
          caseId: loc.caseId,
          tweaks: loc.tweaks,
        })
      }
      const m = manifestRef.current
      if (m) setMode(resolveMode(loc, m))
      setDocOpen(loc.docs)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // Toggle a component's case list open/closed without navigating.
  const toggleExpanded = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // Navigate to a component's first case. Collapse every other accordion so only
  // this component stays open (and reopen it if it was manually collapsed).
  const selectComponent = useCallback(
    (c: ManifestComponent) => {
      const first = c.cases[0]
      if (!first) return
      select({ componentId: c.id, caseId: first.id, tweaks: {} })
      setExpanded(new Set([c.id]))
    },
    [select],
  )

  // Whenever the selected component changes — by any path: a component click, a
  // case click in another component, a flow `goto`, or a deep-link — collapse
  // every other accordion so only the active component stays open. Keyed on the
  // component id, so manual chevron toggles between navigations are preserved
  // (they don't change the id and so don't re-fire this).
  const selectedComponentId = sel?.componentId
  useEffect(() => {
    if (!selectedComponentId) return
    setExpanded(new Set([selectedComponentId]))
  }, [selectedComponentId])

  // Keep the active nav row on screen. A deep link can land straight on a
  // component far down the rail — taller than the viewport — leaving its
  // highlighted row scrolled out of view. Re-run on the selection (the row's
  // `data-current` follows `sel`), on `expanded` (a case row only mounts once
  // its component is open, so the first pass may not find it yet), and on
  // `shownMode` (the library nav isn't mounted in Primer view). The first
  // reveal centers the row so it clears the rail's edge fade mask; afterwards
  // `block: 'nearest'` keeps an off-screen selection in view without yanking
  // rows that are already visible, so an ordinary click never jumps the rail.
  const didInitialNavScrollRef = useRef(false)
  // biome-ignore lint/correctness/useExhaustiveDependencies: `expanded` isn't read here but a case row only mounts once its component is expanded, so re-run to find it
  useEffect(() => {
    if (shownMode === 'primer') return
    const container = navScrollRef.current
    if (!container || !sel?.componentId) return
    const raf = requestAnimationFrame(() => {
      // Prefer the active case row; fall back to the component row when there is
      // none (a single-case leaf, or a collapsed parent, renders no case row).
      const caseEl = sel.caseId
        ? container.querySelector<HTMLElement>(
            `[data-testid="${DcTestIds.navCase(sel.componentId, sel.caseId)}"]`,
          )
        : null
      const el =
        caseEl ??
        container.querySelector<HTMLElement>(
          `[data-testid="${DcTestIds.navComponent(sel.componentId)}"]`,
        )
      if (!el) return
      el.scrollIntoView({
        block: didInitialNavScrollRef.current ? 'nearest' : 'center',
      })
      didInitialNavScrollRef.current = true
    })
    return () => cancelAnimationFrame(raf)
  }, [sel?.componentId, sel?.caseId, expanded, shownMode])

  // Drop the previous exhibit's measured size when the *shown* case changes, so
  // the new one is sized from its own report. Keyed on `shownSel` (not `sel`) so
  // it fires at the swap point — while the stage is hidden — not when the user
  // first clicks.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset keyed on shown selection
  useEffect(() => {
    setContent(null)
  }, [shownSel?.componentId, shownSel?.caseId])

  // Crossfade controller. When the *exhibit* (component or case) changes, fade
  // the stage out, then — once it's hidden — swap `shownSel` to the new
  // selection so the iframe content, size, and mode all change behind the fade.
  // The reveal effect (below) fades it back in once measured.
  //
  // A tweak-only change keeps the same exhibit: the frame retweaks in place via
  // postMessage (see the push effect below), so we swap `shownSel` immediately
  // with no fade — adjusting a knob shouldn't blink the stage.
  useEffect(() => {
    const next = selRef.current
    const shown = shownSelRef.current
    if (!next || !shown) return
    // Already in lock-step (initial mount, a flow's in-place goto, or a theme
    // toggle that left the selection untouched): nothing to do.
    if (selSignature(shown) === selSig) return
    const sameExhibit =
      shown.componentId === next.componentId && shown.caseId === next.caseId
    if (sameExhibit) {
      // Tweak-only change: swap in place, no crossfade.
      setShownSel(next)
      return
    }
    setStageShown(false) // fade out; `shownSel` holds so the box keeps its size
    setColorSnap(true) // snap the a11y colour while faded — see the fade-in effect
    const id = setTimeout(() => setShownSel(next), STAGE_FADE_MS)
    return () => clearTimeout(id)
  }, [selSig])

  const groups = useMemo(
    () => groupByLevel(manifest?.components ?? []),
    [manifest],
  )

  // Exhibits mode: ungrouped surfaces + the nested IA group tree.
  const exhibitView = useMemo(
    () => (manifest ? buildExhibitView(manifest) : { ungrouped: [], tree: [] }),
    [manifest],
  )

  // The active surface's group path for the stage breadcrumb. Empty for a kit
  // component or a surface in the default group.
  const breadcrumb = useMemo(() => {
    const comp = manifest?.components.find((c) => c.id === sel?.componentId)
    return comp && isSurfaceLevel(comp.level) ? comp.group : []
  }, [manifest, sel?.componentId])

  const primerGroups = useMemo(
    () => groupPrimerSections(primerSections),
    [primerSections],
  )

  // Keep the TOC accordion in step with the reading position. Whenever the
  // active section changes — the first section reports active on load, then the
  // scrollspy tracks it as the reader scrolls — open the group that owns it
  // (heading or one of its Displays) and collapse the rest. A section in the
  // leading headless group collapses every heading group. The functional update
  // is a no-op while the active section stays within the open group, so a manual
  // chevron toggle survives until the reader scrolls into a different group.
  useEffect(() => {
    if (!primerActive) return
    const owner = primerGroups.find(
      (g) =>
        g.heading?.id === primerActive ||
        g.items.some((it) => it.id === primerActive),
    )
    const headingId = owner?.heading?.id
    setPrimerExpanded((prev) => {
      const already = headingId
        ? prev.size === 1 && prev.has(headingId)
        : prev.size === 0
      if (already) return prev
      return headingId ? new Set([headingId]) : new Set()
    })
  }, [primerActive, primerGroups])

  // The stage renders the *shown* selection (which trails `sel` across a fade),
  // not `sel` itself — so the exhibit, its size, and its mode change together
  // while hidden.
  const component =
    manifest?.components.find((c) => c.id === shownSel?.componentId) ?? null
  const activeCase =
    component?.cases.find((c) => c.id === shownSel?.caseId) ?? null

  // The exhibit's shareable /render address (origin-prefixed). Computed here so
  // the pure view doesn't reach for `window.location`. `origin` starts empty
  // (matching the server render) and is filled in after hydration, so the copied
  // address becomes absolute without a hydration mismatch.
  const addressUrl = activeCase
    ? buildAddressUrl(
        activeCase.renderUrl,
        theme,
        shownSel?.tweaks ?? {},
        origin,
      )
    : ''

  // Full pages and flows are exhibited on a clean, framed stage; smaller
  // component levels (atoms…templates, and unclassified) keep the vitrine
  // dotted grid + corner ticks that help judge a component's edges.
  const stageDecor = component?.level !== 'page' && !component?.isFlow

  // Callback ref: (re)attach a ResizeObserver to the preview panel to track the
  // space available for fit-to-panel scaling.
  const attachPreview = useCallback((el: HTMLDivElement | null) => {
    previewObserver.current?.disconnect()
    if (!el) return
    // Measure the *content* box (clientWidth/Height include padding); the frame
    // must fit inside that, or it overflows by the padding and shows a scrollbar.
    const measure = () => {
      const cs = getComputedStyle(el)
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)
      const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)
      // The Stage's caption strip sits inside the preview but above the body the
      // frame-box lives in, so it steals vertical room the fit math must not
      // count. Without reserving it, a fitted size (device W×H, or a responsive
      // width whose content fills the height) scales to the full preview height,
      // then the caption pushes the stage past the bottom — and `.dc-preview`'s
      // `align-items: safe center` snaps the overflow to the top, jamming the
      // exhibit above the corner ticks. Subtract its measured height (0 before it
      // mounts) so the panel height reflects the space the body actually gets.
      const caption = el.querySelector('.dcui-stage-caption')
      const captionH = caption ? caption.getBoundingClientRect().height : 0
      setPanel({
        w: Math.max(0, Math.floor(el.clientWidth - padX)),
        h: Math.max(0, Math.floor(el.clientHeight - padY - captionH)),
      })
    }
    measure()
    // Observe the preview for available-space changes, and the caption too so a
    // font swap or wrap that changes its height re-runs the fit.
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    const caption = el.querySelector('.dcui-stage-caption')
    if (caption) ro.observe(caption)
    previewObserver.current = ro
  }, [])

  // Resolve the active sizing mode into concrete iframe dimensions + scale.
  const responsive = RESPONSIVE.find((r) => r.id === sizeId)
  const device = DEVICES.find((d) => d.id === sizeId)
  let fixed: { w: number; h: number } | null = null
  if (sizeId === 'custom') fixed = custom
  else if (device) fixed = { w: device.w, h: device.h }

  const responsiveWidth =
    responsive && responsive.width !== 'full' ? responsive.width : null
  // A "fitted" mode has fixed pixel dimensions that must auto-scale to stay
  // fully on-screen: device presets (W×H — both axes) and the numbered
  // responsive widths (Desktop/Tablet/Mobile — width only). Only "Responsive
  // (full)" zooms manually.
  const fitted = fixed !== null || responsiveWidth !== null

  // In the default Responsive (full) view a decorated component shrink-wraps to
  // its natural width — the render frame is told to `fit` — so a small component
  // (a square button, a chip) doesn't stretch to fill the frame. Picking a
  // preset/device width opts back into full-width layout for responsive testing.
  const fitWidth = stageDecor && !fixed && responsiveWidth === null

  // Fade the stage in once the shown exhibit has caught up to the selection and
  // the render frame has reported *its* size (matched by signature, so an
  // in-flight size report for the previous exhibit can't reveal early). This
  // gate is what keeps a swap from flashing at the wrong size.
  const stageMeasured =
    shownSel != null && measuredSig === selSignature(shownSel)
  useEffect(() => {
    if (!shownSel) return
    if (selSignature(shownSel) !== selSig) return // still mid-swap
    if (stageMeasured) setStageShown(true)
  }, [shownSel, selSig, stageMeasured])

  // Release the a11y colour snap once the fade-in has finished, so in-place state
  // changes (a scan resolving while the panel is visible) ease again. Keyed on
  // the fade-in starting (stageShown → true); a new navigation re-arms the snap.
  useEffect(() => {
    if (!stageShown) return
    const id = setTimeout(() => setColorSnap(false), STAGE_FADE_MS)
    return () => clearTimeout(id)
  }, [stageShown])

  // Area available for the (scaled) component. A decorated component reserves at
  // least a 1-dot margin (+1px border) on each side so a near-max component can
  // give back padding for width; a page/flow uses the whole panel (edge-to-edge).
  const reserve = stageDecor ? MIN_PAD + 1 : 0
  const availW = Math.max(1, panel.w - 2 * reserve)
  const availH = Math.max(1, panel.h - 2 * reserve)

  // `renderH` is the iframe element's height — the viewport the component lays
  // out against (kept = panel height in Responsive mode so `vh`/media queries
  // stay stable and never feed back as the visible box shrinks). `visibleH` is
  // how much of it the stage actually shows: a decorated component (atom…
  // template) is clipped to its own measured height and centered on the grid,
  // while pages/flows — and anything not yet measured — fill the panel.
  let targetW: number
  let renderH: number
  let visibleH: number
  if (fixed) {
    targetW = fixed.w
    renderH = fixed.h
    visibleH = fixed.h
  } else if (stageDecor) {
    // Decorated: render at the preset width (or the available width), and clip
    // to the component's own height so the frame hugs it (centered on the grid).
    targetW = responsiveWidth ?? availW
    renderH = panel.h
    // Until the new case reports its size, collapse to nothing so the vitrine
    // rests at its CSS min size (centered) rather than ballooning to fill the
    // panel — a full-height box overflows by the caption strip and `safe center`
    // snaps it to the top-left for a frame. It grows once `dc-size` lands.
    visibleH = content && content.h > 0 ? Math.min(content.h, availH) : 0
  } else {
    // Page/flow: fill the frame edge-to-edge.
    targetW = responsiveWidth ?? panel.w
    renderH = panel.h
    visibleH = panel.h
  }

  // Scale a fitted mode down to fit the available area (never up past 100%): a
  // device fits both axes; a numbered responsive width fits horizontally (its
  // height fills/conforms). Full responsive uses the manual zoom.
  let scale = manualZoom
  if (fixed) {
    scale =
      panel.w > 0 && panel.h > 0
        ? Math.min(availW / fixed.w, availH / fixed.h, 1)
        : 1
  } else if (responsiveWidth !== null) {
    scale = panel.w > 0 ? Math.min(availW / responsiveWidth, 1) : 1
  }
  // When fitting width, the iframe still renders at `targetW` (a stable viewport
  // so `vw`/media queries don't shift), but the box clips to the component's own
  // measured width so the frame hugs it horizontally — symmetric with `visibleH`.
  let visibleW = targetW
  if (fitWidth) {
    // Measured: hug the content's width. Unmeasured: collapse to the vitrine's
    // min width (centered) rather than full width — symmetric with `visibleH`.
    visibleW = content && content.w > 0 ? Math.min(content.w, targetW) : 0
  }
  // Value for the width input: a fixed width, the responsive preset width, or
  // blank (Full / auto).
  const widthInputValue = fixed ? fixed.w : (responsiveWidth ?? '')
  // The currently set size, for the stage caption meta: a named responsive
  // preset (Responsive / Desktop / Tablet / Mobile), else a fixed W×H
  // (device or custom).
  let sizeMeta = fixed ? `${fixed.w} × ${fixed.h}` : 'Responsive'
  if (responsive) sizeMeta = responsive.label
  // The frame box occupies the *scaled* size so the panel can center it and
  // scroll to every edge (no left-side cutoff when zoomed in). Ceil (not floor)
  // so a fractional scaled dimension never crops the component's right/bottom
  // edge — flooring shaved a sub-pixel row/column, cutting the last border.
  //
  // A decorated exhibit hugs its own measured size, so when the rightmost (or
  // bottom) element's border sits *exactly* on the measured edge — e.g. a
  // full-width `<input>` whose box-sizing border lands flush at `fit-content` —
  // the clip seam coincides with that border and `overflow: hidden` eats it
  // (ceil can't help: the value is already integral). A 1px guard on the hugged
  // axes keeps the seam off the border without a visible gap (it falls inside
  // the grid margin). Skipped for pages/flows, which fill the panel edge-to-edge
  // and would overflow it by the guard.
  const edgeGuard = stageDecor ? 1 : 0
  const boxW = Math.max(1, Math.ceil(visibleW * scale) + edgeGuard)
  // The box clips the iframe (which is `renderH` tall) to the *visible* height,
  // hiding everything below the component so the grid shows through. Ceil (not
  // floor) so a fractional scaled height never crops the component's bottom edge
  // — flooring it shaved a sub-pixel row, cutting the last border.
  const boxH = Math.max(1, Math.ceil(visibleH * scale) + edgeGuard)
  // Grid margin around the exhibit, scaled to the spare room (1–3 dots) on each
  // axis. Driven inline since it's dynamic; only decorated stages get it.
  const padX = stageDecor ? gridPad(panel.w, boxW) : 0
  const padY = stageDecor ? gridPad(panel.h, boxH) : 0

  // Editing a dimension or rotating switches to a custom fixed size, seeded from
  // the current dimensions so the untouched axis is preserved.
  const editDim = (axis: 'w' | 'h', raw: string) => {
    const value = Math.max(1, Math.round(Number(raw) || 0))
    const base = fixed ?? { w: targetW || 1280, h: renderH || 800 }
    setCustom({ ...base, [axis]: value })
    setSizeId('custom')
  }
  const rotateDims = () => {
    if (!fixed) return
    setCustom({ w: fixed.h, h: fixed.w })
    setSizeId('custom')
  }

  // Drag the doc panel's left edge to resize it. Dragging left (toward the
  // content) widens it; the width is clamped and applied via a CSS variable so
  // the narrow-screen stacking rule still wins.
  const startDocResize = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      const startX = e.clientX
      const startW = docWidth
      const onMove = (ev: PointerEvent) => {
        const next = startW + (startX - ev.clientX)
        setDocWidth(Math.max(DOC_MIN_W, Math.min(DOC_MAX_W, next)))
      }
      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [docWidth],
  )
  // Keyboard resize: arrows nudge by one grid step (left widens, like the drag).
  const onDocResizeKey = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      let step = 0
      if (e.key === 'ArrowLeft') step = GRID
      else if (e.key === 'ArrowRight') step = -GRID
      if (!step) return
      e.preventDefault()
      setDocWidth((w) => Math.max(DOC_MIN_W, Math.min(DOC_MAX_W, w + step)))
    },
    [],
  )

  // Persist the sidebar width on an explicit resize (drag end / key), so a blank
  // mount never clobbers a remembered value.
  const persistSidebarWidth = useCallback((w: number) => {
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(w))
    } catch {
      // Storage unavailable — width simply won't persist this session.
    }
  }, [])

  // Drag the sidebar's right edge: moving right widens it, clamped to
  // [min, max]; the final width is remembered.
  const startSidebarResize = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      const startX = e.clientX
      const startW = sidebarWidth
      let latest = startW
      const onMove = (ev: PointerEvent) => {
        latest = Math.max(
          SIDEBAR_MIN_W,
          Math.min(SIDEBAR_MAX_W, startW + (ev.clientX - startX)),
        )
        setSidebarWidth(latest)
      }
      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        persistSidebarWidth(latest)
      }
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [sidebarWidth, persistSidebarWidth],
  )
  // Keyboard resize: arrows nudge by one grid step (right widens, like the drag).
  const onSidebarResizeKey = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      let step = 0
      if (e.key === 'ArrowRight') step = GRID
      else if (e.key === 'ArrowLeft') step = -GRID
      if (!step) return
      e.preventDefault()
      setSidebarWidth((w) => {
        const next = Math.max(SIDEBAR_MIN_W, Math.min(SIDEBAR_MAX_W, w + step))
        persistSidebarWidth(next)
        return next
      })
    },
    [persistSidebarWidth],
  )

  // Drive the token theme from the document root so html/body (not just the
  // app chrome) pick up the themed background — no white bars around the app.
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  // Capture a fixed initial src once a case is available; never change it after.
  // biome-ignore lint/correctness/useExhaustiveDependencies: initial-only (frameSrc gate); fit is the initial mode's value
  useEffect(() => {
    if (frameSrc || !activeCase) return
    setFrameSrc(
      buildRenderSrc(
        activeCase.renderUrl,
        theme,
        shownSel?.tweaks ?? {},
        fitWidth,
        stageDecor,
      ),
    )
  }, [frameSrc, activeCase, theme, shownSel?.tweaks])

  // Listen for the render frame's readiness handshake and in-flow transitions.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== frameRef.current?.contentWindow) return
      const data = e.data as {
        type?: string
        state?: {
          componentId: string
          caseId: string
          tweaks: Record<string, string>
        }
        size?: { width: number; height: number }
      }
      if (data?.type === 'dc-ready') {
        setFrameReady(true)
        return
      }
      // The render frame reported its content's natural size — used to shrink
      // the iframe to the component in Responsive mode. Tag the measurement with
      // the exhibit it belongs to (what the iframe is currently showing) so the
      // reveal gate only trusts a size that matches the shown selection.
      if (data?.type === 'dc-size' && data.size) {
        setContent({ w: data.size.width, h: data.size.height })
        if (shownSelRef.current) {
          setMeasuredSig(selSignature(shownSelRef.current))
        }
        return
      }
      // A flow step advanced itself via `goto` — follow it so the sidebar's
      // active step and the address stay in sync with the preview. The iframe
      // already transitioned in place, so move `shownSel` in lock-step (no
      // crossfade — the controller sees the stage already matches `sel`).
      if (data?.type === 'dc-step-changed' && data.state) {
        const next = {
          componentId: data.state.componentId,
          caseId: data.state.caseId,
          tweaks: data.state.tweaks ?? {},
        }
        select(next)
        setShownSel(next)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [select])

  // Push the current selection into the frame in place (no reload).
  useEffect(() => {
    if (!frameReady || !component || !activeCase) return
    frameRef.current?.contentWindow?.postMessage(
      {
        type: 'dc-render',
        state: {
          componentId: component.id,
          caseId: activeCase.id,
          theme,
          width: null,
          tweaks: shownSel?.tweaks ?? {},
          fit: fitWidth,
          transparent: stageDecor,
        },
      },
      '*',
    )
  }, [
    frameReady,
    component,
    activeCase,
    theme,
    shownSel?.tweaks,
    fitWidth,
    stageDecor,
  ])

  // Load the doc when the active component changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed by component id
  useEffect(() => {
    setDocText(null)
    if (!component?.placardDoc) return
    fetch(`/doc/${component.id}`)
      .then((r) => (r.ok ? r.text() : null))
      .then(setDocText)
  }, [component?.id])

  // Request the viewed variant's a11y result whenever the selection or theme
  // changes (per-theme, since contrast differs by theme). The result arrives
  // here (cached) or later over the SSE stream.
  useEffect(() => {
    if (!a11yEnabled || !component || !activeCase) return
    requestA11y(component.id, activeCase.id, theme)
  }, [a11yEnabled, component, activeCase, theme, requestA11y])

  // One SSE subscription drives live a11y pushes and (in non-dev) the rebuild
  // refresh. The render iframe reloads itself via its own document script; here
  // we refetch the manifest (so added/removed cases appear) and re-request the
  // current variant's a11y (its cache may have been invalidated by the edit).
  // In `--dev` the shell does a full reload instead (chrome may have changed).
  // biome-ignore lint/correctness/useExhaustiveDependencies: subscribe once for the session
  useEffect(() => {
    if (!a11yEnabled && !dcConfig?.reload) return
    const es = new EventSource('/__livereload')
    if (a11yEnabled) {
      es.addEventListener('a11y', (e) => {
        try {
          const d = JSON.parse((e as MessageEvent).data)
          // From the live scan completing → cascade the reveal.
          applyA11yResult(d.component, d.case, d.theme, d, true)
        } catch {
          // ignore malformed event
        }
      })
    }
    if (dcConfig?.reload && !dcConfig?.dev) {
      es.addEventListener('reload', (e) => {
        // A shell-bundle change (the chrome itself) needs a full reload — the
        // injected styles + chrome code only re-run on a fresh document. A
        // content-only change refreshes the manifest + re-requests a11y while the
        // stage iframe reloads itself, preserving nav state.
        if ((e as MessageEvent).data === 'shell') {
          location.reload()
          return
        }
        fetch('/manifest.json')
          .then((r) => r.json())
          .then((m: Manifest) => setManifest(m))
          .catch(() => {})
        const cur = a11yCurRef.current
        if (a11yEnabled && cur.c && cur.cs && cur.th) {
          requestA11y(cur.c, cur.cs, cur.th)
        }
      })
    }
    return () => es.close()
  }, [])

  // Seed the nav markers from every verdict the server already knows at connect
  // time — start-up population (the `cached`/`refresh` modes) and any scan that
  // completed before this tab opened. SSE only carries events emitted *after* we
  // subscribe, so without this one-shot replay a freshly opened tab would show
  // an empty nav until each variant is viewed. Results land via `applyA11yResult`
  // with `fromScan: false`, so only the markers fill in — the panel (keyed to
  // the viewed variant) is untouched.
  // biome-ignore lint/correctness/useExhaustiveDependencies: seed once on mount
  useEffect(() => {
    if (!a11yEnabled) return
    fetch('/a11y/known')
      .then((r) => r.json())
      .then(
        (
          rows: Array<{
            component: string
            case: string
            theme: string
            status: 'ok' | 'pending' | 'unavailable'
            violations?: A11yViolation[]
            reason?: string
          }>,
        ) => {
          for (const d of rows)
            applyA11yResult(d.component, d.case, d.theme, d, false)
        },
      )
      .catch(() => {})
  }, [])

  if (!manifest) return { manifest: null }

  // Shared opacity crossfade for every region that swaps on a mode change (nav
  // body, screen content, mode-specific header controls). They fade as one.
  const modeFadeStyle: CSSProperties = {
    opacity: modeContentShown ? 1 : 0,
    transition: `opacity ${MODE_FADE_MS}ms var(--dc-ease)`,
  }

  return {
    manifest,
    theme,
    setTheme,
    navCollapsed,
    setNavCollapsed,
    sidebarWidth,
    startSidebarResize,
    onSidebarResizeKey,
    mode,
    setMode: changeMode,
    shownMode,
    modeFadeStyle,
    sizeId,
    setSizeId,
    manualZoom,
    setManualZoom,
    showGrid,
    setShowGrid,
    widthInputValue,
    fixed,
    fitted,
    scale,
    sizeMeta,
    editDim,
    rotateDims,
    stageDecor,
    component,
    activeCase,
    addressUrl,
    shownSel,
    sel,
    docOpen,
    changeDocsOpen,
    docText,
    docWidth,
    startDocResize,
    onDocResizeKey,
    tweaksFloating,
    setTweaksFloating,
    a11y,
    rescanA11y,
    navScrollRef,
    navBodyRef,
    groups,
    exhibitView,
    filter,
    setFilter,
    breadcrumb,
    expanded,
    toggleExpanded,
    selectComponent,
    select,
    primerGroups,
    primerActive,
    primerExpanded,
    togglePrimerGroup,
    scrollToSection,
    attachPreview,
    padX,
    padY,
    stageShown,
    colorSnap,
    boxW,
    boxH,
    frameRef,
    frameSrc,
    targetW,
    renderH,
    primerRef,
    primerSrc,
  }
}
