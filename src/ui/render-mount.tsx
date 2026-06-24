import { flushSync } from 'react-dom'
import type { Root } from 'react-dom/client'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { slugify } from '../core/catalog'
import type { CaseModule, DisplayCaseConfig, GotoFn } from '../index'
import { caseTree, encodeOverrides } from '../render/render-node'

/**
 * Entry point for the isolated `/render/:component/:case` document. Renders
 * exactly one case (wrapped in the optional decorator) into #root and nothing
 * else — this is what the browse iframe embeds and what screenshot tools
 * capture.
 *
 * Three ways to drive it:
 *  - **Standalone** (snapshot/screenshot tools, direct navigation): the target
 *    case + theme + width + tweaks are read from the URL on load.
 *  - **Embedded** (browse chrome iframe): after announcing readiness, the parent
 *    pushes `dc-render` messages to swap case/theme/width/tweaks *in place*, so
 *    the iframe never reloads or remounts — no flicker on switch or tweak.
 *  - **In-flow transition**: a flow step calls its injected `goto`, which makes
 *    the target step active in place, updates the address (so the new step is
 *    deep-linkable/snapshottable), and notifies the chrome via `dc-step-changed`.
 */

interface RenderState {
  componentId: string
  caseId: string
  theme: 'light' | 'dark'
  width: number | null
  tweaks: Record<string, string>
  /** Shrink-wrap #root to the case's natural width (so a small component
   *  doesn't stretch to fill the frame). Driven by the browse chrome. */
  fit: boolean
  /** Drop the document background so the component shows on the stage's grid.
   *  Decorated components only; the chrome never sets it for pages/flows. */
  transparent: boolean
}

interface NavOptions {
  /** Push the active step to history so it is directly addressable. */
  pushUrl?: boolean
  /** Tell the parent chrome the active step changed (in-flow transitions). */
  notifyParent?: boolean
}

function stateFromUrl(): RenderState {
  const params = new URLSearchParams(window.location.search)
  const parts = window.location.pathname.split('/').filter(Boolean)
  const widthParam = params.get('width')
  const tweaks: Record<string, string> = {}
  for (const [k, v] of params) {
    if (k.startsWith('t.')) tweaks[k.slice(2)] = v
  }
  return {
    // Path shape: /render/<component>/<case>
    componentId: parts[1] ?? '',
    caseId: parts[2] ?? '',
    theme: params.get('theme') === 'dark' ? 'dark' : 'light',
    width: widthParam ? Number(widthParam) : null,
    tweaks,
    fit: params.get('fit') === '1',
    transparent: params.get('transparent') === '1',
  }
}

/** Write the active step into the address so it can be deep-linked/snapshotted. */
function pushStepUrl(state: RenderState): void {
  const params = new URLSearchParams()
  params.set('theme', state.theme)
  if (state.width) params.set('width', String(state.width))
  for (const [k, v] of Object.entries(state.tweaks)) params.set(`t.${k}`, v)
  window.history.pushState(
    null,
    '',
    `/render/${state.componentId}/${state.caseId}?${params.toString()}`,
  )
}

/**
 * Apply a render's document-level effects — the parts that live outside the
 * React tree and so are set imperatively, not rendered. The server bakes these
 * same values into the delivered document (so the first paint is correct and
 * hydration matches); re-applying them here is idempotent on first load and
 * carries an in-place swap (theme/width/transparent change) that the server
 * never sees.
 */
function applyDocEffects(state: RenderState): void {
  document.documentElement.dataset.theme = state.theme
  // Also set the explicit preference so a `ThemeProvider` used inside app chrome
  // (e.g. Navbar's ThemeToggle) initializes to the harness theme
  // rather than re-resolving from the OS and fighting the `?theme=` selection.
  document.documentElement.dataset.themePref = state.theme

  // Shrink-wrap the mount to the case's natural width when asked, so a
  // block/flex-rooted component (which would otherwise fill the full-width
  // frame) renders at its intrinsic size. The chrome measures the result and
  // hugs the stage to it. Cleared (full width) for pages/flows and presets.
  const mount = document.getElementById('root')
  if (mount) mount.style.width = state.fit ? 'fit-content' : ''

  // Drop the document background so a decorated component sits directly on the
  // stage's dotted grid (the chrome's stage frame paints the surface + grid
  // behind the transparent iframe). Cleared back to the token bg otherwise.
  document.body.style.background = state.transparent ? 'transparent' : ''

  // Mark decorated exhibits (atoms…templates — never pages/flows, which lay out
  // their own full-bleed structure) so the render doc can center the exhibit's
  // content in the frame by default. Keyed off the same flag as `transparent`.
  document.body.toggleAttribute('data-decorated', state.transparent)
}

/** Build the case's React tree — the identical tree the server pre-rendered —
 *  wiring a flow step's `goto` to drive an in-place transition. */
function treeFor(
  modules: CaseModule[],
  config: DisplayCaseConfig,
  state: RenderState,
  navigate: (next: RenderState, opts?: NavOptions) => void,
) {
  const goto: GotoFn = (target, overrides) => {
    // A transition makes the target step active in place; the new step gets its
    // own address (overrides become its preset state) and the chrome is told to
    // follow.
    navigate(
      { ...state, caseId: slugify(target), tweaks: encodeOverrides(overrides) },
      { pushUrl: true, notifyParent: true },
    )
  }
  return caseTree(
    modules,
    config,
    {
      componentId: state.componentId,
      caseId: state.caseId,
      width: state.width,
      tweaks: state.tweaks,
    },
    goto,
  )
}

/**
 * Neutralize anchor clicks that would unload the render frame. A case or flow
 * step can legitimately render a real `<a href="/dashboard">` (the route would
 * supply a router `<Link>`), but in this isolated frame there is no router, so a
 * click does a full-document navigation to a non-render path. The server then
 * serves the browse shell *into the frame*, nesting a shell and severing the
 * parent↔frame handshake — every case/flow appears broken until a manual reload.
 * Same-document hash links (in-page scroll) and `target=_blank` (new context)
 * are harmless and left alone.
 */
function blockFrameNavigation(): void {
  document.addEventListener(
    'click',
    (e) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return
      }
      const anchor = (e.target as HTMLElement | null)?.closest?.('a')
      const href = anchor?.getAttribute('href')
      if (!anchor || !href) return
      if (anchor.target && anchor.target !== '_self') return // new tab/window
      const url = new URL(href, window.location.href)
      const sameDocumentHash =
        url.pathname === window.location.pathname &&
        url.search === window.location.search &&
        url.hash !== ''
      if (sameDocumentHash) return // in-page scroll, doesn't unload the frame
      e.preventDefault()
    },
    true,
  )
}

/** Encode a render selection into its `/render/<comp>/<case>` address, mirroring
 *  the chrome's `buildRenderSrc` so a cross-component navigation lands on a
 *  document whose first paint already reflects theme/width/tweaks/fit/decor. */
function renderUrlFor(state: RenderState): string {
  const params = new URLSearchParams()
  params.set('theme', state.theme)
  if (state.width) params.set('width', String(state.width))
  for (const [k, v] of Object.entries(state.tweaks)) params.set(`t.${k}`, v)
  if (state.fit) params.set('fit', '1')
  if (state.transparent) params.set('transparent', '1')
  return `/render/${state.componentId}/${state.caseId}?${params.toString()}`
}

export function mountRender(
  modules: CaseModule[],
  config: DisplayCaseConfig,
): void {
  blockFrameNavigation()
  const rootEl = document.getElementById('root') as HTMLElement
  // Each on-demand bundle carries one component's cases. A `dc-render` for a
  // different component can't be satisfied in place (its module isn't here), so
  // the frame navigates to that component's address, loading its bundle. The
  // target equals what the chrome just selected, so the chrome stays in sync.
  const ownComponentIds = new Set(modules.map((m) => slugify(m.component)))
  // The server pre-rendered the case into #root and flagged it `data-ssr="1"`;
  // adopt that markup instead of mounting from scratch. A browser-only case is
  // delivered empty (`data-ssr="0"`) and mounted fresh on the client.
  const ssr = rootEl.dataset.ssr === '1'
  let root: Root | null = null
  let state = stateFromUrl()
  const embedded = !!(window.parent && window.parent !== window)

  // Report the rendered content's natural size to the browse chrome so it can
  // shrink the iframe to the component (instead of stretching it to fill the
  // panel) and center it on the stage. Measured off #root: its block height is
  // the content height regardless of the iframe's (possibly taller) viewport,
  // which `documentElement.scrollHeight` would clamp to. Hoisted above navigate
  // so every swap re-announces the size — the ResizeObserver below only fires on
  // an actual size *change*, so a swap between two same-size cases would never
  // re-report, leaving the chrome (which hides the stage until the new size
  // lands) waiting forever.
  const postSize = (): void => {
    if (!embedded) return
    window.parent.postMessage(
      {
        type: 'dc-size',
        size: {
          height: Math.ceil(rootEl.scrollHeight),
          width: Math.ceil(rootEl.scrollWidth),
        },
      },
      '*',
    )
  }

  // Single entry point for every state change — initial render, parent-driven
  // `dc-render` swaps, and in-flow `goto` transitions all flow through here.
  const navigate = (next: RenderState, opts: NavOptions = {}): void => {
    state = next
    if (opts.pushUrl) pushStepUrl(state)
    if (opts.notifyParent && embedded) {
      window.parent.postMessage(
        {
          type: 'dc-step-changed',
          state: {
            componentId: state.componentId,
            caseId: state.caseId,
            tweaks: state.tweaks,
          },
        },
        '*',
      )
    }
    applyDocEffects(state)
    const tree = treeFor(modules, config, state, navigate)
    if (!root) {
      // First commit: adopt the server markup (hydrate) when present, otherwise
      // mount fresh. Hydration is its own commit, so it isn't wrapped in
      // flushSync; a recoverable mismatch (a non-deterministic case) is logged
      // and React re-renders that subtree on the client.
      if (ssr) {
        root = hydrateRoot(rootEl, tree, {
          onRecoverableError: (err) =>
            console.warn(
              '[display-case] adopt mismatch; client re-rendered:',
              err,
            ),
        })
      } else {
        root = createRoot(rootEl)
        flushSync(() => (root as Root).render(tree))
      }
    } else {
      // Commit synchronously so the measurement reads this case's layout (not the
      // previous one's), then re-announce the size for this navigation.
      flushSync(() => (root as Root).render(tree))
    }
    postSize()
  }

  navigate(state)

  // Async layout changes (late images/fonts, content that resizes after mount)
  // re-announce via the observer; navigate() covers the synchronous swaps.
  if (embedded) new ResizeObserver(postSize).observe(rootEl)

  // Embedded mode: accept in-place updates from the browse chrome so switching
  // case / theme / width / tweaks never reloads the iframe.
  window.addEventListener('message', (e: MessageEvent) => {
    if (e.source !== window.parent) return
    const data = e.data as { type?: string; state?: Partial<RenderState> }
    if (data?.type !== 'dc-render' || !data.state) return
    const next = { ...state, ...data.state }
    // A different component than this bundle holds: load its document/bundle.
    if (next.componentId && !ownComponentIds.has(next.componentId)) {
      window.location.assign(renderUrlFor(next))
      return
    }
    navigate(next)
  })

  // Announce readiness so the parent can push the current selection. Harmless
  // when standalone (parent is self; no dc-render messages are sent).
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: 'dc-ready' }, '*')
  }
}
