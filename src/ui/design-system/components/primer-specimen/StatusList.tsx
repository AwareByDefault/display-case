import './styles'

/**
 * Display Case — StatusList
 * A row of status items: a coloured dot beside a name and a short caption, each
 * boxed in a hairline card. Generic specimen primitive for a Primer — use it to
 * document a small reserved set of status hues (pass, warn, fail) or any other
 * dot-keyed legend.
 *
 * Each item's `color` is a complete CSS value (`var(--dc-success)` or a hex);
 * keep the whole `var(...)` literal so the token-conformance check resolves it.
 */

export interface StatusItem {
  /** Status name shown in bold (also the React key). */
  name: string
  /** Complete CSS colour value painted on the dot. */
  color: string
  /** Short caption under the name (e.g. the underlying token). */
  caption?: string
}

export interface StatusListProps {
  items: StatusItem[]
}

export function StatusList({ items }: StatusListProps) {
  return (
    <div className="dcpl-status">
      {items.map((s) => (
        <div className="dcpl-statusitem" key={s.name}>
          <div className="dcpl-statusdot" style={{ background: s.color }} />
          <div>
            <b>{s.name}</b>
            {s.caption ? <span>{s.caption}</span> : null}
          </div>
        </div>
      ))}
    </div>
  )
}
