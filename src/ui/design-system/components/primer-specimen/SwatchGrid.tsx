/**
 * Display Case — SwatchGrid
 * A grid of role swatches: a colour chip beside a token name and a short role
 * note. Generic specimen primitive for a Primer — use it to document the
 * semantic role tokens a system exposes (canvas, surface, border, text, accent…).
 *
 * Each swatch's `color` is a complete CSS value (`var(--dc-surface)` or a hex);
 * keep the whole `var(...)` literal so the token-conformance check resolves it.
 */

export interface Swatch {
  /** Token name shown in bold (also the React key). */
  token: string
  /** Complete CSS colour value painted on the chip. */
  color: string
  /** Short role note under the token. */
  role?: string
}

export interface SwatchGridProps {
  swatches: Swatch[]
  /** Number of columns in the grid. */
  columns?: number
}

export function SwatchGrid({ swatches, columns = 4 }: SwatchGridProps) {
  return (
    <div
      className="dcpl-swgrid"
      style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {swatches.map((s) => (
        <div className="dcpl-swrow" key={s.token}>
          <div className="dcpl-swchip" style={{ background: s.color }} />
          <div className="dcpl-swtok">
            <b>{s.token}</b>
            {s.role ? <span>{s.role}</span> : null}
          </div>
        </div>
      ))}
    </div>
  )
}
