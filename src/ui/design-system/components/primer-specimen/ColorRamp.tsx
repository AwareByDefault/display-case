/**
 * Display Case — ColorRamp
 * A horizontal ramp of colour stops with a label + caption under each chip.
 * Generic specimen primitive for a Primer: feed it any ordered set of stops
 * (an accent ramp, a neutral ramp, a brand palette) and it renders the swatches.
 *
 * Pass each stop's colour as a complete CSS value (`var(--dc-marigold-600)` or
 * `#c2690a`) — keep the whole `var(...)` string literal rather than templating
 * it, so the token-conformance check can statically resolve the reference.
 */

export interface ColorStop {
  /** Display label under the chip (also the React key). */
  name: string
  /** Complete CSS colour value painted on the chip, e.g. `var(--dc-marigold-600)`. */
  color: string
  /** Optional caption under the name — typically the resolved hex. */
  caption?: string
  /** Marks the canonical stop with a marigold star. */
  star?: boolean
}

export interface ColorRampProps {
  stops: ColorStop[]
  /** Chip height in pixels. */
  chipHeight?: number
}

export function ColorRamp({ stops, chipHeight = 56 }: ColorRampProps) {
  return (
    <div
      className="dcpl-ramp"
      style={{ gridTemplateColumns: `repeat(${stops.length}, 1fr)` }}>
      {stops.map((s) => (
        <div className="dcpl-sw" key={s.name}>
          <div
            className="dcpl-sw-chip"
            style={{ height: `${chipHeight}px`, background: s.color }}
          />
          <div className="dcpl-sw-meta">
            <div className="dcpl-sw-name">
              {s.name}
              {s.star ? <span className="dcpl-sw-star"> ★</span> : null}
            </div>
            {s.caption ? <div className="dcpl-sw-hex">{s.caption}</div> : null}
          </div>
        </div>
      ))}
    </div>
  )
}
