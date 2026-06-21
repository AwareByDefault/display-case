/**
 * Brand specimen for Display Case's own Primer — the icon vocabulary. Display
 * Case has no icon font, no SVG set, and no emoji: its entire vocabulary is
 * Unicode glyphs rendered in the UI font.
 *
 * A thin, document-specific wrapper: the glyph data lives here; the reusable
 * {@link GlyphGrid} primitive (under `components/primer-specimen/`) renders it.
 */
import { GlyphGrid, type GlyphSpec } from '../components/primer-specimen'

const GLYPHS: GlyphSpec[] = [
  { glyph: '☰', use: 'Toggle nav' },
  { glyph: '▸', use: 'Disclosure' },
  { glyph: '⟲', use: 'Rotate' },
  { glyph: '✕', use: 'Close' },
  { glyph: '★', use: 'Emphasis' },
  { glyph: '←', use: 'Prev' },
  { glyph: '→', use: 'Next' },
  { glyph: '−', use: 'Zoom out' },
  { glyph: '＋', use: 'Zoom in' },
  { glyph: '×', use: 'Dimension' },
]

export function Glyphs() {
  return <GlyphGrid glyphs={GLYPHS} columns={5} />
}
