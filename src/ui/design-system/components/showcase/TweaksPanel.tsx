import type {
  CSSProperties,
  ReactNode,
  PointerEvent as ReactPointerEvent,
} from 'react'
import { useEffect, useRef, useState } from 'react'
import { IconButton } from '../controls/IconButton'
import { injectStyle } from '../inject-style'
import { Eyebrow } from './Eyebrow'

/**
 * Display Case — TweaksPanel
 * The grouped controls panel — tweaks bundled into one bordered card, mono label
 * left, control right. Two modes:
 *   · "docked"   — sits in flow beneath the stage (the calm default).
 *   · "floating" — a free, draggable overlay (position:fixed, the one sanctioned
 *                  floating surface, so it earns the overlay shadow). Drag the
 *                  head to roam anywhere — over the nav, header, and docs.
 * Pass `onToggleMode` to render the dock/float switch in the header.
 */

const CSS = `
.dcui-tweaks {
  border: 1px solid var(--dc-border);
  border-radius: var(--dc-radius-md);
  background: var(--dc-surface);
  padding: var(--dc-space-6) var(--dc-space-8);
}
/* Undocked: a free overlay over a large exhibit, so it shrinks its own
   footprint — tighter padding, narrower column, smaller type (below). */
.dcui-tweaks[data-mode="floating"] {
  position: fixed;
  right: var(--dc-space-8);
  bottom: var(--dc-space-8);
  width: 16rem;
  max-width: calc(100vw - var(--dc-space-12));
  max-height: calc(100vh - var(--dc-space-12));
  overflow-y: auto;
  padding: var(--dc-space-4) var(--dc-space-6);
  border-radius: var(--dc-radius-lg);
  box-shadow: var(--dc-shadow-overlay);
  z-index: 50;
}
.dcui-tweaks-head {
  display: flex;
  align-items: center;
  gap: var(--dc-space-4);
  margin-bottom: var(--dc-space-4);
}
.dcui-tweaks[data-mode="floating"] .dcui-tweaks-head {
  cursor: grab;
  touch-action: none;
  user-select: none;
  gap: var(--dc-space-3);
  /* margins negate the (tighter) floating panel padding to span its edges */
  margin: calc(-1 * var(--dc-space-4)) calc(-1 * var(--dc-space-6)) var(--dc-space-3);
  padding: var(--dc-space-3) var(--dc-space-6);
  border-bottom: 1px solid var(--dc-border);
  transition: margin-bottom var(--dc-transition-base);
}
.dcui-tweaks[data-mode="floating"][data-dragging="true"] .dcui-tweaks-head { cursor: grabbing; }
.dcui-tweaks-grip {
  flex: 0 0 auto;
  font-family: var(--dc-font-mono);
  font-size: var(--dc-text-sm);
  line-height: 1;
  color: var(--dc-fg-subtle);
}
.dcui-tweaks[data-mode="docked"] .dcui-tweaks-grip { display: none; }
.dcui-tweaks-url {
  margin-left: auto;
  font-family: var(--dc-font-mono);
  font-size: var(--dc-text-xs);
  color: var(--dc-fg-subtle);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dcui-tweaks-toggle { margin-left: auto; flex: 0 0 auto; }
.dcui-tweaks-url + .dcui-tweaks-toggle { margin-left: var(--dc-space-2); }
.dcui-tweaks-rows { display: flex; flex-direction: column; }
.dcui-tweak-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--dc-space-8);
  padding: var(--dc-space-3) 0;
}
.dcui-tweak-row + .dcui-tweak-row { border-top: 1px solid var(--dc-border); }
.dcui-tweak-label {
  font-family: var(--dc-font-mono);
  font-size: var(--dc-text-sm);
  color: var(--dc-fg-muted);
}
.dcui-tweak-control { display: flex; align-items: center; gap: var(--dc-space-4); }

/* --- Undocked compaction — smaller type, tighter rows --------- */
.dcui-tweaks[data-mode="floating"] .dcui-eyebrow,
.dcui-tweaks[data-mode="floating"] .dcui-tweaks-grip,
.dcui-tweaks[data-mode="floating"] .dcui-tweaks-url {
  font-size: var(--dc-text-2xs);
}
.dcui-tweaks[data-mode="floating"] .dcui-tweak-row {
  gap: var(--dc-space-6);
  padding: var(--dc-space-2) 0;
}
.dcui-tweaks[data-mode="floating"] .dcui-tweak-label {
  font-size: var(--dc-text-2xs);
}
/* Shrink the controls too — shorter, smaller type than their own "sm".
   The .dcui-tweak-control hop outweighs each control's [data-size="sm"]. */
.dcui-tweaks[data-mode="floating"] .dcui-tweak-control .dcui-field,
.dcui-tweaks[data-mode="floating"] .dcui-tweak-control .dcui-select-el {
  height: 22px;
  font-size: var(--dc-text-2xs);
}
.dcui-tweaks[data-mode="floating"] .dcui-tweak-control input[type="checkbox"] {
  width: 13px;
  height: 13px;
}

/* --- Undocked collapse — chevron hides/shows the rows ---------- */
.dcui-tweaks-collapse-btn { flex: 0 0 auto; }
/* The disclosure triangle (matches the nav). It centers cleanly in its em box,
   so it sits square with the title. Open → points down; collapsed → sideways. */
.dcui-tweaks-chevron {
  display: inline-block;
  font-size: 0.65rem;
  line-height: 1;
  transform: rotate(90deg);
  transition: transform var(--dc-transition-base);
}
.dcui-tweaks[data-collapsed="true"] .dcui-tweaks-chevron {
  transform: rotate(0deg);
}
/* The rows live in a grid whose single track animates 1fr → 0fr. The
   wrapper is inert when docked, so focus rings there are never clipped. */
.dcui-tweaks[data-mode="floating"] .dcui-tweaks-collapse {
  display: grid;
  grid-template-rows: 1fr;
  transition: grid-template-rows var(--dc-transition-base);
}
.dcui-tweaks[data-mode="floating"] .dcui-tweaks-collapse > .dcui-tweaks-rows {
  overflow: hidden;
  min-height: 0;
}
.dcui-tweaks[data-mode="floating"][data-collapsed="true"] .dcui-tweaks-collapse {
  grid-template-rows: 0fr;
}
.dcui-tweaks[data-mode="floating"][data-collapsed="true"] .dcui-tweaks-head {
  margin-bottom: 0;
}
/* Docked collapse: no height animation (the docked wrapper is left un-clipped so
   focus rings show), just hide the rows and drop the header's bottom margin so
   the panel shrinks to its header bar — reclaiming stage space on a crowded
   page. */
.dcui-tweaks[data-mode="docked"][data-collapsed="true"] .dcui-tweaks-collapse {
  display: none;
}
.dcui-tweaks[data-mode="docked"][data-collapsed="true"] .dcui-tweaks-head {
  margin-bottom: 0;
}
@media (prefers-reduced-motion: reduce) {
  .dcui-tweaks-chevron,
  .dcui-tweaks[data-mode="floating"] .dcui-tweaks-head,
  .dcui-tweaks[data-mode="floating"] .dcui-tweaks-collapse {
    transition: none;
  }
}
`
injectStyle('dcui-tweaks', CSS)

export type TweaksMode = 'docked' | 'floating'

export interface TweakItem {
  label: ReactNode
  control: ReactNode
}

export interface TweaksPanelProps {
  title?: ReactNode
  /** The shareable, snapshottable tweaked-state URL (an AI-forward affordance). */
  url?: ReactNode
  mode?: TweaksMode
  onToggleMode?: () => void
  items?: TweakItem[]
  children?: ReactNode
}

/**
 * The box a `position: fixed` child is laid out against: normally the viewport,
 * but an ancestor with a transform / filter / perspective / will-change /
 * contain establishes its own containing block. Display Case traps the floating
 * panel in such an ancestor (so it stays inside the stage), so drag-clamping has
 * to measure against whichever one actually applies — not always the viewport.
 */
function fixedBounds(el: HTMLElement) {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const cs = getComputedStyle(p)
    if (
      cs.transform !== 'none' ||
      cs.perspective !== 'none' ||
      cs.filter !== 'none' ||
      cs.willChange === 'transform' ||
      cs.contain
        .split(' ')
        .some(
          (v) =>
            v === 'layout' ||
            v === 'paint' ||
            v === 'strict' ||
            v === 'content',
        )
    ) {
      const r = p.getBoundingClientRect()
      return { left: r.left, top: r.top, width: r.width, height: r.height }
    }
  }
  return {
    left: 0,
    top: 0,
    width: window.innerWidth,
    height: window.innerHeight,
  }
}

export function Row({
  label,
  children,
}: {
  label: ReactNode
  children: ReactNode
}) {
  return (
    <div className="dcui-tweak-row">
      <span className="dcui-tweak-label">{label}</span>
      <div className="dcui-tweak-control">{children}</div>
    </div>
  )
}

export function TweaksPanel({
  title = 'Tweaks',
  url,
  mode = 'docked',
  onToggleMode,
  items,
  children,
}: TweaksPanelProps) {
  const floating = mode === 'floating'
  const ref = useRef<HTMLElement | null>(null)
  const drag = useRef<{
    dx: number
    dy: number
    w: number
    h: number
    bx: number
    by: number
    bw: number
    bh: number
  } | null>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  // Undocked-only: collapse the rows to a header-sized card.
  const [collapsed, setCollapsed] = useState(false)

  // Re-anchor (drop the custom position) whenever we leave floating mode.
  useEffect(() => {
    if (!floating) setPos(null)
  }, [floating])

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!floating || !ref.current) return
    // ignore drags that start on a header button (dock toggle, collapse chevron)
    if ((e.target as HTMLElement).closest('button')) return
    const r = ref.current.getBoundingClientRect()
    const b = fixedBounds(ref.current)
    drag.current = {
      dx: e.clientX - r.left,
      dy: e.clientY - r.top,
      w: r.width,
      h: r.height,
      bx: b.left,
      by: b.top,
      bw: b.width,
      bh: b.height,
    }
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    // Clamp inside the containing block (the viewport in the app, the trapping
    // surface in the stage) so the panel can't be dragged off its frame; left/
    // top are expressed relative to that block, matching position:fixed.
    const left = Math.max(0, Math.min(e.clientX - d.dx - d.bx, d.bw - d.w))
    const top = Math.max(0, Math.min(e.clientY - d.dy - d.by, d.bh - d.h))
    setPos({ left, top })
  }
  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    drag.current = null
    setDragging(false)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // capture may already be released
    }
  }

  // Once dragged, switch from right/bottom anchoring to explicit left/top.
  const posStyle: CSSProperties | undefined =
    floating && pos
      ? { left: pos.left, top: pos.top, right: 'auto', bottom: 'auto' }
      : undefined

  return (
    <section
      ref={ref}
      className="dcui-tweaks"
      data-mode={mode}
      data-dragging={dragging ? 'true' : undefined}
      data-collapsed={collapsed ? 'true' : undefined}
      style={posStyle}>
      <div
        className="dcui-tweaks-head"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}>
        {floating ? (
          <span className="dcui-tweaks-grip" aria-hidden="true">
            ⠿
          </span>
        ) : null}
        <Eyebrow>{title}</Eyebrow>
        {/* Collapse the rows in both modes — floating shrinks the overlay,
            docked saves vertical space when the stage is crowded. */}
        <span className="dcui-tweaks-collapse-btn">
          <IconButton
            size="sm"
            variant="bare"
            aria-expanded={!collapsed}
            glyph={
              <span className="dcui-tweaks-chevron" aria-hidden="true">
                ▸
              </span>
            }
            label={collapsed ? 'Show tweak options' : 'Hide tweak options'}
            onClick={() => setCollapsed((c) => !c)}
          />
        </span>
        {url != null ? <span className="dcui-tweaks-url">{url}</span> : null}
        {onToggleMode ? (
          <span className="dcui-tweaks-toggle">
            <IconButton
              size="sm"
              variant="bare"
              active={floating}
              glyph={floating ? '▭' : '⬓'}
              label={floating ? 'Dock tweaks panel' : 'Float tweaks panel'}
              onClick={onToggleMode}
            />
          </span>
        ) : null}
      </div>
      <div className="dcui-tweaks-collapse">
        <div className="dcui-tweaks-rows">
          {items
            ? items.map((it, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: tweak rows are a fixed, ordered list
                <Row key={i} label={it.label}>
                  {it.control}
                </Row>
              ))
            : children}
        </div>
      </div>
    </section>
  )
}
