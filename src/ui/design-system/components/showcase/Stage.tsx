import type { CSSProperties, ReactNode } from 'react'
import { injectStyle } from '../inject-style'

/**
 * Display Case — Stage
 * The vitrine: the framed surface a component is exhibited on. Hairline border,
 * soft corner ticks (the "case" motif), an optional dotted graph-paper grid, and
 * an optional mono caption strip. Keep it quiet — the exhibit leads.
 *
 * The browse chrome's preview stage, sized by `frame`: `hug` shrinks to the
 * exhibit with a minimum size + a dynamic grid margin (`padX`/`padY`); `fill`
 * stretches edge-to-edge for full pages. `surface` overrides the body backdrop
 * (e.g. the consumer app's own bg).
 */

const CSS = `
.dcui-stage {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  border: 1px solid var(--dc-border);
  border-radius: var(--dc-radius-md);
  background: var(--dc-surface);
  overflow: hidden;
}
/* Live-frame sizing (the browse chrome's preview). */
.dcui-stage[data-frame="hug"] {
  flex: 0 0 auto;
  min-width: min(22rem, 100%);
  min-height: min(11rem, 100%);
  max-width: 100%;
  max-height: 100%;
}
.dcui-stage[data-frame="fill"] {
  align-self: stretch;
  width: 100%;
}
.dcui-stage-caption {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--dc-space-4);
  padding: var(--dc-space-4) var(--dc-space-6);
  border-bottom: 1px solid var(--dc-border);
  background: var(--dc-bg-subtle);
}
.dcui-stage-caption-label {
  font-family: var(--dc-font-mono);
  font-size: var(--dc-text-xs);
  font-weight: var(--dc-weight-medium);
  letter-spacing: var(--dc-tracking-label);
  text-transform: uppercase;
  color: var(--dc-fg-muted);
}
.dcui-stage-caption-meta {
  font-family: var(--dc-font-mono);
  font-size: var(--dc-text-xs);
  color: var(--dc-fg-subtle);
}
.dcui-stage-body {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  padding: 0;
}
/* hug-frame sets the body padding inline (the dynamic grid margin); a filled
   frame stays edge-to-edge. */
.dcui-stage[data-grid="true"] .dcui-stage-body {
  background-image: radial-gradient(var(--dc-border) 1px, transparent 1px);
  background-size: 16px 16px;
  background-position: -1px -1px;
}
.dcui-stage-corner {
  position: absolute;
  width: 9px;
  height: 9px;
  border: 1.5px solid var(--dc-border-strong);
  pointer-events: none;
  z-index: 1;
}
.dcui-stage-corner[data-c="tl"] { top: 8px; left: 8px; border-right: 0; border-bottom: 0; }
.dcui-stage-corner[data-c="tr"] { top: 8px; right: 8px; border-left: 0; border-bottom: 0; }
.dcui-stage-corner[data-c="bl"] { bottom: 8px; left: 8px; border-right: 0; border-top: 0; }
.dcui-stage-corner[data-c="br"] { bottom: 8px; right: 8px; border-left: 0; border-top: 0; }
`
injectStyle('dcui-stage', CSS)

export type StageFrame = 'hug' | 'fill'

export interface StageProps {
  caption?: ReactNode
  meta?: ReactNode
  grid?: boolean
  corners?: boolean
  /** Sizing mode: `hug` (shrink to the exhibit + min size) or `fill`
   *  (stretch edge-to-edge). */
  frame: StageFrame
  /** Dynamic grid-margin padding (px) for `frame="hug"`. */
  padX?: number
  padY?: number
  /** Override the body backdrop colour (e.g. the consumer app's `--color-bg`). */
  surface?: string
  children?: ReactNode
  style?: CSSProperties
}

export function Stage({
  caption,
  meta,
  grid = false,
  corners = true,
  frame,
  padX,
  padY,
  surface,
  children,
  style,
}: StageProps) {
  const outerStyle: CSSProperties | undefined =
    surface || style
      ? { ...(surface ? { background: surface } : {}), ...style }
      : undefined
  const bodyStyle: CSSProperties | undefined =
    padX != null && padY != null
      ? { padding: `${padY}px ${padX}px` }
      : undefined
  return (
    <div
      className="dcui-stage"
      data-grid={grid ? 'true' : undefined}
      data-frame={frame}
      style={outerStyle}>
      {caption != null ? (
        <div className="dcui-stage-caption">
          <span className="dcui-stage-caption-label">{caption}</span>
          {meta != null ? (
            <span className="dcui-stage-caption-meta">{meta}</span>
          ) : null}
        </div>
      ) : null}
      <div className="dcui-stage-body" style={bodyStyle}>
        {corners ? (
          <>
            <span
              className="dcui-stage-corner"
              data-c="tl"
              aria-hidden="true"
            />
            <span
              className="dcui-stage-corner"
              data-c="tr"
              aria-hidden="true"
            />
            <span
              className="dcui-stage-corner"
              data-c="bl"
              aria-hidden="true"
            />
            <span
              className="dcui-stage-corner"
              data-c="br"
              aria-hidden="true"
            />
          </>
        ) : null}
        {children}
      </div>
    </div>
  )
}
