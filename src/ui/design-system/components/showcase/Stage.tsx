import type { CSSProperties, ReactNode } from 'react'

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
