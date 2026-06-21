**SwatchGrid** — a grid of UNORDERED semantic role tokens, each a colour chip beside a token name and a short role note; reach for it to document the roles a system exposes (canvas, surface, border, text, accent…).

```tsx
<SwatchGrid
  columns={4}
  swatches={[
    { token: 'surface', color: 'var(--dc-surface)', role: 'inputs' },
    { token: 'brand', color: 'var(--dc-brand)', role: 'accent' },
  ]}
/>
```

For an ordered single family shown as a ramp, reach for `ColorRamp`.

Keep each `color` as the whole `var(--dc-…)` literal so the token check resolves it.
