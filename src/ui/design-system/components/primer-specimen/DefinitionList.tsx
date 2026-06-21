import type { ReactNode } from 'react'
import './styles'

/**
 * Display Case — DefinitionList
 * A bordered list of term / description rows. The term is a mono uppercase
 * eyebrow in the accent colour; the description is body text that may include
 * `<strong>` emphasis. Generic specimen primitive for a Primer — use it to lay
 * out voice rules, content fundamentals, or any keyed reference.
 */

export interface DefEntry {
  /** Mono uppercase term shown in the accent colour (also the React key). */
  term: string
  /** Description body — plain text or rich nodes (e.g. `<strong>`). */
  description: ReactNode
}

export interface DefinitionListProps {
  entries: DefEntry[]
  /** Width of the term column (any CSS length). */
  termWidth?: string
}

export function DefinitionList({
  entries,
  termWidth = '7.5rem',
}: DefinitionListProps) {
  return (
    <div className="dcpl-deflist">
      {entries.map((e) => (
        <div
          className="dcpl-defrow"
          key={e.term}
          style={{ gridTemplateColumns: `${termWidth} 1fr` }}>
          <div className="dcpl-defterm">{e.term}</div>
          <div className="dcpl-defdesc">{e.description}</div>
        </div>
      ))}
    </div>
  )
}
