/**
 * Display Case — TypeScale
 * A column of type-size rows: a mono tag beside a live sample rendered at the
 * step's size. Generic specimen primitive for a Primer — use it to document a
 * type scale at its real sizes.
 */

export interface TypeStep {
  /** Mono tag on the left (e.g. `base · 14`); also the React key. */
  tag: string
  /** CSS font-size the sample renders at (e.g. `14px`, `1.5rem`). */
  size: string
  /** The sample text rendered at `size`. */
  sample: string
}

export interface TypeScaleProps {
  steps: TypeStep[]
}

export function TypeScale({ steps }: TypeScaleProps) {
  return (
    <div className="dcpl-scale">
      {steps.map((s) => (
        <div className="dcpl-scalerow" key={s.tag}>
          <div className="dcpl-scaletag">{s.tag}</div>
          <div className="dcpl-scalespec" style={{ fontSize: s.size }}>
            {s.sample}
          </div>
        </div>
      ))}
    </div>
  )
}
