/**
 * Display Case — SpacingScale
 * A column of spacing rows: a mono token tag, its resolved value, and a bar
 * whose width visualises the step. Generic specimen primitive for a Primer —
 * use it to show a spacing scale to scale.
 */

export interface SpaceStep {
  /** Mono token tag (e.g. `space-4`); also the React key. */
  token: string
  /** Resolved value shown in mono (e.g. `8px`). */
  value: string
  /** Bar width in pixels — visualises the step. */
  width: number
}

export interface SpacingScaleProps {
  steps: SpaceStep[]
}

export function SpacingScale({ steps }: SpacingScaleProps) {
  return (
    <div className="dcpl-spacescale">
      {steps.map((s) => (
        <div className="dcpl-spacerow" key={s.token}>
          <div className="dcpl-spacetag">{s.token}</div>
          <div className="dcpl-spacepx">{s.value}</div>
          <div className="dcpl-spacebar" style={{ width: `${s.width}px` }} />
        </div>
      ))}
    </div>
  )
}
