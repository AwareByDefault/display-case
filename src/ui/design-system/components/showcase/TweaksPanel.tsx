import type {
  CSSProperties,
  ReactNode,
  PointerEvent as ReactPointerEvent,
} from 'react'
import { useEffect, useRef, useState } from 'react'
import { IconButton } from '../controls/IconButton'
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
