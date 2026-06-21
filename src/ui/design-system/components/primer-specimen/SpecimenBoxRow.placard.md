**SpecimenBoxRow** — a row of labelled boxes, each a flat surface whose own style carries the thing
being shown (a corner radius, a border weight, an elevation shadow), over a
label + note. A reusable Primer specimen that generalises the radius and
elevation rows, so one component documents any box-led token.

```tsx
<SpecimenBoxRow
  items={[
    { label: 'md', note: '8px · panels', boxStyle: { borderRadius: 'var(--dc-radius-md)' } },
    { note: 'overlay', content: 'overlay', boxStyle: { boxShadow: 'var(--dc-shadow-overlay)' } },
  ]}
/>
```

`boxStyle` paints the specimen itself (radius, border, shadow…); `content` is an optional node centred inside the box.

Use this when the token IS the box's own shape. For a flat colour chip beside a token use `SwatchGrid`; for a width bar use `SpacingScale`; for a glyph tile use `GlyphGrid`.
