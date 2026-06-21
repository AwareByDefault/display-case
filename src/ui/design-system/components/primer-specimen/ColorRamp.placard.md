**ColorRamp** — a horizontal ramp of an ORDERED single-family palette (an accent ramp, a neutral ramp), each stop a chip over a label and optional caption. Reach for it when the stops have a meaningful sequence.

```tsx
<ColorRamp
  chipHeight={56}
  stops={[
    { name: 'marigold-500', color: 'var(--dc-marigold-500)', caption: '#e0820b' },
    { name: 'marigold-600', color: 'var(--dc-marigold-600)', caption: '#c2690a', star: true },
  ]}
/>
```

For unordered semantic role tokens, reach for `SwatchGrid`.

Keep each `color` as the whole `var(--dc-…)` literal so the token check resolves it. `star` marks the canonical stop with a marigold ★.
