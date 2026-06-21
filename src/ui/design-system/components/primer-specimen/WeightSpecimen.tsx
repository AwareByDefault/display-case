import type { ReactNode } from 'react'

/**
 * Display Case — WeightSpecimen
 * A row of weight samples, each set at its own font-weight over a mono caption.
 * Generic specimen primitive for a Primer — use it to show the weights a system
 * uses and what each is for. An optional `footer` slot hangs extra content (a
 * divider, an eyebrow sample) below the row.
 */

export interface WeightSpec {
  /** Numeric font-weight (also the React key). */
  weight: number
  /** Sample word shown at this weight. */
  name: string
  /** Mono role caption (e.g. `body`, `titles`). */
  role?: string
}

export interface WeightSpecimenProps {
  weights: WeightSpec[]
  /** Optional content rendered below the weights (e.g. a divider + eyebrow). */
  footer?: ReactNode
}

export function WeightSpecimen({ weights, footer }: WeightSpecimenProps) {
  return (
    <div className="dcpl-block">
      <div className="dcpl-weights">
        {weights.map((w) => (
          <div
            className="dcpl-weight"
            key={w.weight}
            style={{ fontWeight: w.weight }}>
            {w.name}
            <span>
              {w.weight}
              {w.role ? ` · ${w.role}` : null}
            </span>
          </div>
        ))}
      </div>
      {footer}
    </div>
  )
}
