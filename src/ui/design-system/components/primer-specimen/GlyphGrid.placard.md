**GlyphGrid** — a grid of glyph tiles, each a large glyph over a short usage caption; reach for it to document an icon vocabulary (Unicode glyphs, an icon-font codepoint set, or any single-character marks).

```tsx
<GlyphGrid
  columns={5}
  glyphs={[
    { glyph: '☰', use: 'Toggle nav' },
    { glyph: '✕', use: 'Close' },
  ]}
/>
```

`use` doubles as the React key — keep captions unique across the grid.
