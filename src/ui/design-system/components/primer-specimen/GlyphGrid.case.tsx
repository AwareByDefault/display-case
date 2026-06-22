import { defineCases, tweak } from '@awarebydefault/display-case'
import { GlyphGrid, type GlyphSpec } from './GlyphGrid'

const glyphs: GlyphSpec[] = [
  { glyph: '☰', use: 'Toggle nav' },
  { glyph: '▸', use: 'Disclosure' },
  { glyph: '⟲', use: 'Rotate' },
  { glyph: '✕', use: 'Close' },
  { glyph: '★', use: 'Emphasis' },
  { glyph: '←', use: 'Prev' },
  { glyph: '→', use: 'Next' },
  { glyph: '＋', use: 'Zoom in' },
  { glyph: '−', use: 'Zoom out' },
  { glyph: '×', use: 'Dimension' },
]

export default defineCases(
  'GlyphGrid',
  {
    Playground: {
      tweaks: { columns: tweak.number(5) },
      render: (t) => <GlyphGrid glyphs={glyphs} columns={t.columns} />,
    },
    Vocabulary: () => <GlyphGrid glyphs={glyphs} />,
  },
  { level: 'molecule' },
)
