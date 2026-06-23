// display-case: no-placard — Display Case's own browse chrome, cased for
// dogfooding (ShellView.case.tsx); internal plumbing, not a consumer primitive.
import { type CSSProperties, type ReactNode, useState } from 'react'
import type { ManifestComponent } from '../../../../core/manifest'
import type { TweakDescriptor } from '../../../../index'
import { DocMarkdown } from '../../../markdown'
import {
  buildUrl,
  componentMatchesFilter,
  DEVICES,
  DOC_MAX_W,
  DOC_MIN_W,
  type ExhibitNode,
  LEVEL_LABEL,
  type Mode,
  RESPONSIVE,
  SIDEBAR_MAX_W,
  SIDEBAR_MIN_W,
  STAGE_FADE_MS,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_STEP,
} from '../../../shell-core'
import { DcTestIds } from '../../../test-ids'
import type { ShellViewModel } from '../../../use-shell'
import type { SegmentedOption } from '..'
import {
  A11yPanel,
  Button,
  Chip,
  Eyebrow,
  FlowNav,
  IconButton,
  Input,
  NavItem,
  RenderAddress,
  SegmentedToggle,
  SelectMenu,
  Sidebar,
  Stage,
  TweaksPanel,
  Wordmark,
} from '..'

/**
 * The browse chrome, as a pure function of its {@link ShellViewModel}. Every
 * piece of state, every derived layout number, and every event handler is fed
 * in — `ShellView` only arranges them into the header, nav rail, stage, and
 * Primer host. The live render/Primer iframes are injected as `renderFrame` /
 * `primerFrame` slots, so the same view paints either the running chrome (real
 * iframes, from {@link useShell}) or a static page/flow exhibit (a stub slot
 * over a hand-built model). This is what lets Display Case dogfood its own
 * layout as a template, page, and flow.
 */
export interface ShellViewProps extends ShellViewModel {
  /** The stage's preview surface — the live `<iframe>` in the app; a static
   *  stand-in (a rendered component, a placeholder box) in a page/template case. */
  renderFrame: ReactNode
  /** The Primer reading surface — the live `<iframe>` in the app; a static
   *  stand-in in a Primer page/template case. */
  primerFrame: ReactNode
  /** Make the stage's frame box fill the stage edge-to-edge instead of sizing to
   *  the measured `boxW`/`boxH`. The live chrome leaves this off (it measures the
   *  panel); a static page/flow *exhibit* sets it so a full-screen page or flow
   *  fills the whole stage rather than sitting in a small centred box. */
  fillFrame?: boolean
}

export function ShellView(props: ShellViewProps) {
  const {
    manifest,
    theme,
    shownMode,
    mode,
    setMode,
    modeFadeStyle,
    sidebarWidth,
    startSidebarResize,
    onSidebarResizeKey,
  } = props
  return (
    <div
      className="dc-app"
      data-testid={DcTestIds.app}
      data-theme={theme}
      data-nav={props.navCollapsed ? 'collapsed' : 'open'}
      style={{ '--dc-sidebar-w': `${sidebarWidth}px` } as CSSProperties}>
      <ShellHeader {...props} />

      <Sidebar data-testid={DcTestIds.sidebar} label={SIDEBAR_LABEL[shownMode]}>
        {/* The ModeSwitch is pinned above the scroll region (a non-scrolling row),
            so it stays put while nav items scroll and fade beneath it, and its
            highlight box keeps lerping during the crossfade. The scroll region's
            fading body tracks `shownMode` so it swaps mid-fade, in step with the
            screen content. Shown only when two or more modes are present. */}
        {manifest.modes.length > 1 && (
          <ModeSwitch modes={manifest.modes} mode={mode} onMode={setMode} />
        )}
        <NavContents {...props} />
        {/* biome-ignore lint/a11y/useSemanticElements: a draggable splitter, not a thematic break */}
        <div
          className="dc-sidebar-resize"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          aria-valuenow={sidebarWidth}
          aria-valuemin={SIDEBAR_MIN_W}
          aria-valuemax={SIDEBAR_MAX_W}
          tabIndex={0}
          data-testid={DcTestIds.sidebarResize}
          onPointerDown={startSidebarResize}
          onKeyDown={onSidebarResizeKey}
        />
      </Sidebar>

      {/* Library main and the Primer host both occupy the `main` grid area; the
          inactive one is `hidden`. Keeping the library mounted preserves the
          render-frame handshake across mode switches. Visibility tracks
          `shownMode` (the swap happens mid-fade) and the whole region rides the
          shared opacity crossfade so the screen content fades out and back in. */}
      <main
        className="dc-main"
        hidden={shownMode === 'primer'}
        style={modeFadeStyle}>
        <LibraryStage {...props} />
      </main>

      {manifest.modes.includes('primer') && (
        <section
          className="dc-primer-host"
          aria-label="Primer"
          hidden={shownMode !== 'primer'}
          style={modeFadeStyle}>
          {props.primerFrame}
        </section>
      )}
    </div>
  )
}

function ShellHeader(props: ShellViewProps) {
  const {
    manifest,
    theme,
    setTheme,
    navCollapsed,
    setNavCollapsed,
    shownMode,
    modeFadeStyle,
    sizeId,
    setSizeId,
    widthInputValue,
    fixed,
    editDim,
    rotateDims,
    fitted,
    scale,
    manualZoom,
    setManualZoom,
    stageDecor,
    showGrid,
    setShowGrid,
    component,
    docOpen,
    changeDocsOpen,
    breadcrumb,
  } = props
  return (
    <header className="dc-header">
      <div className="dc-header-left">
        <IconButton
          glyph="☰"
          label="Toggle navigation"
          aria-expanded={!navCollapsed}
          onClick={() => setNavCollapsed((c) => !c)}
        />
        <Wordmark data-testid={DcTestIds.wordmark}>{manifest.title}</Wordmark>
        {/* The active surface's information-architecture path (Exhibits mode). */}
        {shownMode === 'exhibits' && breadcrumb.length > 0 && (
          <nav
            className="dc-breadcrumb"
            aria-label="Group path"
            data-testid={DcTestIds.breadcrumb}
            style={modeFadeStyle}>
            {breadcrumb.map((seg, i) => (
              <Chip key={seg} current={i === breadcrumb.length - 1}>
                {seg}
              </Chip>
            ))}
          </nav>
        )}
      </div>
      <div className="dc-controls">
        {/* The device toolbar, zoom, grid and docs controls act on the stage,
            so they're library-only; the Primer view keeps just the theme
            toggle. Gated on `shownMode` (not `mode`) and wrapped in a fading
            group so they fade out before the swap to Primer and fade in after
            the swap to Cases — in step with the nav and screen crossfade. */}
        {shownMode !== 'primer' && (
          <div className="dc-controls-extra" style={modeFadeStyle}>
            {/* The custom listbox (not a native <select>) so a pick commits
                instantly and the trigger styling matches the tweak controls.
                Disabled options stand in as the Responsive / Devices group
                headers. */}
            <SelectMenu
              size="sm"
              value={sizeId}
              onChange={setSizeId}
              aria-label="Screen size"
              options={[
                { value: '__responsive', label: 'Responsive', disabled: true },
                ...RESPONSIVE.map((r) => ({ value: r.id, label: r.label })),
                { value: '__devices', label: 'Devices', disabled: true },
                ...DEVICES.map((d) => ({ value: d.id, label: d.label })),
                { value: 'custom', label: 'Custom…' },
              ]}
            />
            <div className="dc-dims">
              <input
                className="dc-dim"
                type="number"
                min={1}
                aria-label="Width (px)"
                disabled={!fixed}
                value={widthInputValue}
                placeholder={fixed ? undefined : 'auto'}
                onChange={(e) => editDim('w', e.target.value)}
              />
              <span className="dc-dim-x">×</span>
              <input
                className="dc-dim"
                type="number"
                min={1}
                aria-label="Height (px)"
                disabled={!fixed}
                value={fixed ? fixed.h : ''}
                placeholder={fixed ? undefined : 'auto'}
                onChange={(e) => editDim('h', e.target.value)}
              />
              <IconButton
                glyph="⟲"
                label="Rotate (swap width and height)"
                variant="bare"
                size="sm"
                disabled={!fixed}
                onClick={rotateDims}
              />
            </div>
            {fitted ? (
              <span
                className="dc-zoom-level dc-zoom-fit"
                title="Scaled to fit the panel">
                {Math.round(scale * 100)}%
              </span>
            ) : (
              <div className="dc-zoom">
                <IconButton
                  glyph="−"
                  label="Zoom out"
                  variant="bare"
                  size="sm"
                  disabled={manualZoom <= ZOOM_MIN}
                  onClick={() =>
                    setManualZoom((z) =>
                      Math.max(ZOOM_MIN, Math.round((z - ZOOM_STEP) * 10) / 10),
                    )
                  }
                />
                <button
                  type="button"
                  className="dc-zoom-level"
                  aria-label="Reset zoom"
                  onClick={() => setManualZoom(() => 1)}>
                  {Math.round(manualZoom * 100)}%
                </button>
                <IconButton
                  glyph="＋"
                  label="Zoom in"
                  variant="bare"
                  size="sm"
                  disabled={manualZoom >= ZOOM_MAX}
                  onClick={() =>
                    setManualZoom((z) =>
                      Math.min(ZOOM_MAX, Math.round((z + ZOOM_STEP) * 10) / 10),
                    )
                  }
                />
              </div>
            )}
            {stageDecor && (
              <Button
                data-testid={DcTestIds.gridButton}
                aria-pressed={showGrid}
                title="Toggle the stage grid (vs the app background)"
                onClick={() => setShowGrid((g) => !g)}>
                Grid
              </Button>
            )}
            {component?.placardDoc && (
              <Button
                data-testid={DcTestIds.docsButton}
                aria-pressed={docOpen}
                aria-expanded={docOpen}
                onClick={() => changeDocsOpen(!docOpen)}>
                Docs
              </Button>
            )}
          </div>
        )}
        <Button
          data-testid={DcTestIds.themeToggle}
          onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}>
          {theme === 'light' ? 'Dark' : 'Light'}
        </Button>
      </div>
    </header>
  )
}

// Default-collapsed exhibit group keys, gathered from the tree's `collapsed` flags.
function defaultClosedGroups(tree: ExhibitNode[]): Set<string> {
  const out = new Set<string>()
  const walk = (nodes: ExhibitNode[]) => {
    for (const n of nodes) {
      if (n.collapsed) out.add(n.path.join('/').toLowerCase())
      walk(n.children)
    }
  }
  walk(tree)
  return out
}

function NavContents(props: ShellViewProps) {
  const {
    shownMode,
    modeFadeStyle,
    navScrollRef,
    navBodyRef,
    primerGroups,
    primerActive,
    primerExpanded,
    togglePrimerGroup,
    scrollToSection,
    groups,
    exhibitView,
    filter,
    setFilter,
    expanded,
    sel,
    toggleExpanded,
    selectComponent,
    select,
  } = props

  // Collapse state for Exhibits groups, seeded from the manifest defaults.
  const [closedGroups, setClosedGroups] = useState<Set<string>>(() =>
    defaultClosedGroups(exhibitView.tree),
  )
  const toggleGroup = (key: string) =>
    setClosedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  const filtering = filter.trim() !== ''

  // One component row (disclosure + cases), reused by every catalog section.
  const componentRow = (c: ManifestComponent) => {
    // A single-case component reads as a leaf: no chevron, no count, no case row.
    const single = c.cases.length === 1
    const isExpanded = !single && expanded.has(c.id)
    // Per-variant violation counts fold onto the parent (collapsed) or the case
    // rows (expanded), exactly as before.
    const variants = props.a11y?.byVariant[c.id]
    const total = variants
      ? Object.values(variants).reduce((a, b) => a + b, 0)
      : 0
    let parentAlert: number | 'dot' | undefined
    if (total > 0) parentAlert = isExpanded ? 'dot' : total
    // Distinguish a flow from a page: a leading glyph (default) or a trailing
    // `flow` tag, plus numbered step rows. Pages render plain.
    const flowMarker = props.manifest.flowMarker ?? 'glyph'
    const flowIcon = c.isFlow && flowMarker === 'glyph' ? FLOW_GLYPH : undefined
    const flowTag = c.isFlow && flowMarker === 'tag' ? 'flow' : undefined
    return (
      <div key={c.id} className="dc-nav-component">
        <NavItem
          kind="component"
          label={c.name}
          icon={flowIcon}
          tag={flowTag}
          count={single ? undefined : c.cases.length}
          alert={parentAlert}
          current={sel?.componentId === c.id}
          expanded={isExpanded}
          testId={DcTestIds.navComponent(c.id)}
          toggleTestId={single ? undefined : DcTestIds.navComponentToggle(c.id)}
          alertTestId={DcTestIds.navAlert(c.id)}
          onToggle={single ? undefined : () => toggleExpanded(c.id)}
          onSelect={() => selectComponent(c)}
        />
        {isExpanded &&
          c.cases.map((cs, i) => (
            <NavItem
              key={cs.id}
              kind="case"
              label={cs.name}
              index={c.isFlow ? i + 1 : undefined}
              alert={variants?.[cs.id]}
              current={sel?.componentId === c.id && sel?.caseId === cs.id}
              testId={DcTestIds.navCase(c.id, cs.id)}
              alertTestId={`${DcTestIds.navAlert(c.id)}-${cs.id}`}
              onSelect={() =>
                select({ componentId: c.id, caseId: cs.id, tweaks: {} })
              }
            />
          ))}
      </div>
    )
  }

  // Components mode: the kit grouped by level, filtered. `null` when nothing matches.
  const renderComponents = (): ReactNode => {
    const fg = groups
      .map((g) => ({
        key: g.key,
        components: g.components.filter((c) =>
          componentMatchesFilter(c, filter),
        ),
      }))
      .filter((g) => g.components.length > 0)
    if (fg.length === 0) return null
    return fg.map(({ key, components }) => (
      <div key={key} className="dc-group">
        <Eyebrow className="dc-group-label">{LEVEL_LABEL[key]}</Eyebrow>
        {components.map(componentRow)}
      </div>
    ))
  }

  // Exhibits mode: nested IA groups, filtered. A group with no matching surfaces
  // and no matching descendants is dropped; while filtering, groups force open.
  const renderExhibitNodes = (nodes: ExhibitNode[]): ReactNode => {
    const out: ReactNode[] = []
    for (const n of nodes) {
      const key = n.path.join('/').toLowerCase()
      const comps = n.components.filter((c) =>
        componentMatchesFilter(c, filter),
      )
      const childContent = renderExhibitNodes(n.children)
      if (comps.length === 0 && childContent === null) continue
      const closed = !filtering && closedGroups.has(key)
      out.push(
        <div key={key} className="dc-group">
          <NavItem
            kind="component"
            label={n.label}
            expanded={!closed}
            testId={DcTestIds.navGroup(key)}
            toggleTestId={`${DcTestIds.navGroup(key)}-toggle`}
            onToggle={() => toggleGroup(key)}
            onSelect={() => toggleGroup(key)}
          />
          {!closed && (
            <div style={{ marginLeft: 'var(--dc-space-3)' }}>
              {comps.map(componentRow)}
              {childContent}
            </div>
          )}
        </div>,
      )
    }
    return out.length ? out : null
  }

  const renderExhibits = (): ReactNode => {
    const ungrouped = exhibitView.ungrouped.filter((c) =>
      componentMatchesFilter(c, filter),
    )
    const tree = renderExhibitNodes(exhibitView.tree)
    if (ungrouped.length === 0 && tree === null) return null
    return (
      <>
        {ungrouped.map(componentRow)}
        {tree}
      </>
    )
  }

  // Primer view: the reading-page table of contents (unchanged).
  if (shownMode === 'primer') {
    return (
      <div ref={navScrollRef} className="dc-nav-scroll">
        <div ref={navBodyRef} className="dc-nav-body" style={modeFadeStyle}>
          {primerGroups.map((g) => {
            const items = g.items.map((s) => (
              <NavItem
                key={s.id}
                kind="case"
                label={s.title}
                current={primerActive === s.id}
                onSelect={() => scrollToSection(s.id)}
              />
            ))
            const heading = g.heading
            if (!heading) {
              return (
                <div key="primer-lead" className="dc-primer-group">
                  <Eyebrow className="dc-group-label">Contents</Eyebrow>
                  {items}
                </div>
              )
            }
            const hasItems = g.items.length > 0
            const collapsed = !primerExpanded.has(heading.id)
            const headingActive =
              primerActive === heading.id ||
              (hasItems &&
                collapsed &&
                g.items.some((it) => it.id === primerActive))
            return (
              <div key={heading.id} className="dc-primer-group">
                <NavItem
                  kind="component"
                  label={heading.title}
                  count={hasItems ? g.items.length : undefined}
                  current={headingActive}
                  expanded={hasItems ? !collapsed : undefined}
                  onToggle={
                    hasItems ? () => togglePrimerGroup(heading.id) : undefined
                  }
                  onSelect={() => scrollToSection(heading.id)}
                />
                {hasItems && !collapsed && items}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Catalog view (Components or Exhibits): a filter input, the active mode's
  // tree, and — while filtering — any matches in the other catalog mode below,
  // with an explicit empty state when the active mode has none.
  const inExhibits = shownMode === 'exhibits'
  const active = inExhibits ? renderExhibits() : renderComponents()
  const otherMode: Mode = inExhibits ? 'components' : 'exhibits'
  const renderOther = () => (inExhibits ? renderComponents() : renderExhibits())
  const other = filtering ? renderOther() : null
  return (
    <div ref={navScrollRef} className="dc-nav-scroll">
      <div ref={navBodyRef} className="dc-nav-body" style={modeFadeStyle}>
        <div className="dc-nav-filter">
          <Input
            size="sm"
            prefix="⌕"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter…"
            aria-label="Filter the sidebar"
            data-testid={DcTestIds.navFilter}
          />
        </div>
        {active}
        {filtering && active === null && (
          <Eyebrow className="dc-group-label">No matches in this mode</Eyebrow>
        )}
        {other && (
          <div className="dc-group">
            <Eyebrow className="dc-group-label">
              In {MODE_LABEL[otherMode]}
            </Eyebrow>
            {other}
          </div>
        )}
      </div>
    </div>
  )
}

function LibraryStage(props: ShellViewProps) {
  const {
    component,
    activeCase,
    addressUrl,
    sel,
    select,
    attachPreview,
    stageDecor,
    showGrid,
    sizeMeta,
    padX,
    padY,
    stageShown,
    boxW,
    boxH,
    fillFrame,
    renderFrame,
    tweaksFloating,
    setTweaksFloating,
    docOpen,
    changeDocsOpen,
    docText,
    docWidth,
    startDocResize,
    onDocResizeKey,
  } = props
  if (!component || !activeCase) {
    return <div className="dc-empty">Select a case.</div>
  }
  // The same crossfade the stage uses (driven by `stageShown`): on navigation the
  // tweaks and accessibility panels fade out, then back in once the new exhibit
  // has swapped in behind the fade — so the whole content column transitions as
  // one instead of the panels snapping while the stage fades.
  const fade: CSSProperties = {
    opacity: stageShown ? 1 : 0,
    transition: `opacity ${STAGE_FADE_MS}ms ease`,
  }
  return (
    <div className="dc-stage">
      <div className="dc-content">
        {/* The exhibit's shareable address: the standalone /render URL for
            what's on the stage (theme + tweak overrides), copyable. */}
        <RenderAddress url={addressUrl} />
        {component.isFlow && (
          <FlowNav
            steps={component.cases.map((cs) => ({
              id: cs.id,
              label: cs.name,
            }))}
            activeId={activeCase.id}
            onSelect={(caseId) =>
              select({ componentId: component.id, caseId, tweaks: {} })
            }
          />
        )}
        {/* The preview is the stable centering viewport (measured for the
            available area); the stage frame inside carries the border,
            grid + corner ticks and hugs the exhibit (decorated) or fills
            the viewport edge-to-edge (pages/flows). */}
        <div className="dc-preview" ref={attachPreview}>
          <Stage
            caption={activeCase.name}
            meta={sizeMeta}
            frame={stageDecor ? 'hug' : 'fill'}
            grid={stageDecor && showGrid}
            corners={stageDecor}
            surface={
              stageDecor && !showGrid
                ? 'var(--color-bg, var(--dc-surface))'
                : undefined
            }
            padX={stageDecor ? padX : undefined}
            padY={stageDecor ? padY : undefined}
            // Crossfade: fade out on navigation, back in once the new
            // exhibit has swapped in (behind the fade) and been measured.
            style={{
              opacity: stageShown ? 1 : 0,
              transition: `opacity ${STAGE_FADE_MS}ms ease`,
            }}>
            <div
              className="dc-frame-box"
              style={
                fillFrame
                  ? { width: '100%', height: '100%' }
                  : { width: `${boxW}px`, height: `${boxH}px` }
              }>
              {renderFrame}
            </div>
          </Stage>
        </div>

        {activeCase.tweaks && (
          <div style={fade}>
            <TweaksPanel
              mode={tweaksFloating ? 'floating' : 'docked'}
              // Surface the live shareable address (the same `/c/…?t.*` the
              // browser is on) so the tweaked state is one copy away.
              url={buildUrl(
                component.id,
                activeCase.id,
                sel?.tweaks ?? {},
                docOpen,
              )}
              onToggleMode={() => setTweaksFloating((f) => !f)}
              items={Object.entries(activeCase.tweaks).map(([key, desc]) => ({
                label: key,
                control: (
                  <TweakControl
                    name={key}
                    desc={desc}
                    current={sel?.tweaks?.[key] ?? String(desc.default)}
                    onChange={(v) =>
                      sel &&
                      select({
                        ...sel,
                        tweaks: { ...(sel.tweaks ?? {}), [key]: v },
                      })
                    }
                  />
                ),
              }))}
            />
          </div>
        )}

        {/* The audit verdict for what's on the stage: the live variant's WCAG
            violations, read in place rather than buried in a CLI log. Sits below
            the Tweaks panel — it's the consequence of the tweaked state (cause →
            effect), and a read-only report tolerates being pushed around by the
            interactive panel above better than the reverse. Mounted only when
            a11y scanning is configured (`a11y` present); otherwise there is no
            panel at all. */}
        {props.a11y && (
          <div style={fade}>
            <A11yPanel
              violations={props.a11y.current}
              reveal={props.a11y.reveal}
              onRescan={props.rescanA11y}
              // Snap the verdict colour for the whole navigation crossfade so it
              // returns in the right colour instead of easing the previous
              // exhibit's colour across the fade (in-place changes still ease).
              instantColor={props.colorSnap}
            />
          </div>
        )}
      </div>

      {component.placardDoc && docOpen && (
        <aside
          className="dc-doc-panel"
          data-testid={DcTestIds.docPanel}
          aria-label="Documentation"
          style={{ '--dc-doc-w': `${docWidth}px` } as CSSProperties}>
          {/* biome-ignore lint/a11y/useSemanticElements: a draggable splitter, not a thematic break */}
          <div
            className="dc-doc-resize"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize documentation panel"
            aria-valuenow={docWidth}
            aria-valuemin={DOC_MIN_W}
            aria-valuemax={DOC_MAX_W}
            tabIndex={0}
            onPointerDown={startDocResize}
            onKeyDown={onDocResizeKey}
          />
          <div className="dc-doc-scroll">
            <div className="dc-doc-head">
              <Eyebrow>Documentation</Eyebrow>
              <IconButton
                glyph="✕"
                variant="bare"
                label="Close documentation"
                onClick={() => changeDocsOpen(false)}
              />
            </div>
            {docText ? <DocMarkdown source={docText} /> : <p>Loading…</p>}
          </div>
        </aside>
      )}
    </div>
  )
}

// Segmented control at the top of the sidebar: switch between the present browse
// modes — Primer (reading page), Components (the kit), and Exhibits (surfaces).
// Rendered only when two or more modes are present; `dc-modeswitch` supplies the
// sidebar-pinning layout (see chrome.css).
const MODE_LABEL: Record<Mode, string> = {
  primer: 'Primer',
  components: 'Components',
  exhibits: 'Exhibits',
}

// Leading glyph marking a flow in the Exhibits sidebar (the default flow marker).
const FLOW_GLYPH = '⤳'

// Accessible name for the nav landmark, per mode.
const SIDEBAR_LABEL: Record<Mode, string> = {
  primer: 'Primer contents',
  components: 'Components',
  exhibits: 'Exhibits',
}

function ModeSwitch({
  modes,
  mode,
  onMode,
}: {
  modes: Mode[]
  mode: Mode
  onMode: (m: Mode) => void
}) {
  const options: SegmentedOption<Mode>[] = modes.map((m) => ({
    id: m,
    label: MODE_LABEL[m],
  }))
  return (
    <SegmentedToggle
      className="dc-modeswitch"
      label="View mode"
      options={options}
      value={mode}
      onChange={onMode}
      testId={DcTestIds.modeSwitch}
    />
  )
}

// Renders one tweak control using the design-system primitives. The TweaksPanel
// row supplies the label, so the control just needs an accessible name.
function TweakControl({
  name,
  desc,
  current,
  onChange,
}: {
  name: string
  desc: TweakDescriptor
  current: string
  onChange: (value: string) => void
}) {
  if (desc.kind === 'boolean') {
    return (
      <input
        type="checkbox"
        aria-label={name}
        checked={current === '1' || current === 'true'}
        onChange={(e) => onChange(e.target.checked ? '1' : '0')}
      />
    )
  }
  if (desc.kind === 'choice') {
    // An accessible custom listbox (not a native <select>) so the picked value
    // commits instantly — a native select on macOS defers its change event until
    // the OS popup dismisses, which lagged the live stage update.
    return (
      <SelectMenu
        size="sm"
        aria-label={name}
        options={desc.options}
        value={current}
        onChange={onChange}
      />
    )
  }
  return (
    <Input
      size="sm"
      aria-label={name}
      type={desc.kind === 'number' ? 'number' : 'text'}
      value={current}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}
