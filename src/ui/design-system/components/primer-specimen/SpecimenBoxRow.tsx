import type { CSSProperties, ReactNode } from 'react'
import './styles'

/**
 * Display Case — SpecimenBoxRow
 * A row of labelled boxes — each a flat surface whose own style carries the
 * thing being shown (a corner radius, a border weight, an elevation shadow),
 * over a label + note. Generic specimen primitive for a Primer: it generalises
 * the radius and elevation rows, so one component documents any box-led token.
 */

export interface BoxSpec {
  /** Bold label under the box (also the React key when `note` is absent). */
  label?: string
  /** Mono caption under the label. */
  note?: string
  /** Style applied to the box — the specimen itself (radius, border, shadow…). */
  boxStyle?: CSSProperties
  /** Optional content rendered inside the box (centred). */
  content?: ReactNode
}

export interface SpecimenBoxRowProps {
  items: BoxSpec[]
}

export function SpecimenBoxRow({ items }: SpecimenBoxRowProps) {
  return (
    <div className="dcpl-boxrow">
      {items.map((item, i) => (
        <div
          className="dcpl-boxitem"
          // Labels/notes may repeat across a row, so fall back to the index.
          key={item.label ?? item.note ?? i}>
          <div className="dcpl-box" style={item.boxStyle}>
            {item.content}
          </div>
          <div className="dcpl-boxlbl">
            {item.label ? <b>{item.label}</b> : null}
            {item.note ? <span>{item.note}</span> : null}
          </div>
        </div>
      ))}
    </div>
  )
}
