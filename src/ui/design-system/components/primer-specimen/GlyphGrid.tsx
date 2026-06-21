import './styles'

/**
 * Display Case — GlyphGrid
 * A grid of glyph tiles, each a large glyph over a short usage caption. Generic
 * specimen primitive for a Primer — use it to document an icon vocabulary
 * (Unicode glyphs, an icon-font codepoint set, or any single-character marks).
 */

export interface GlyphSpec {
  /** The glyph to render large. */
  glyph: string
  /** Short usage caption (also the React key). */
  use: string
}

export interface GlyphGridProps {
  glyphs: GlyphSpec[]
  /** Number of columns in the grid. */
  columns?: number
}

export function GlyphGrid({ glyphs, columns = 5 }: GlyphGridProps) {
  return (
    <div
      className="dcpl-icongrid"
      style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {glyphs.map((g) => (
        <div className="dcpl-iconitem" key={g.use}>
          <div className="dcpl-iconglyph">{g.glyph}</div>
          <div className="dcpl-iconuse">{g.use}</div>
        </div>
      ))}
    </div>
  )
}
