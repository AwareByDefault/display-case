**StatusList** — a row of status items, a coloured dot beside a name and a short caption, each
boxed in a hairline card. A reusable Primer specimen for documenting a small
reserved set of status hues (pass, warn, fail) or any dot-keyed legend.

```tsx
<StatusList
  items={[
    { name: 'success', color: 'var(--dc-success)', caption: 'green-600' },
    { name: 'danger', color: 'var(--dc-danger)', caption: 'red-600' },
  ]}
/>
```

Keep each `color` as the whole `var(--dc-…)` literal so the token check resolves it.

Use this for a fixed legend of named statuses. For an ordered single-family ramp reach for `ColorRamp`; for a grid of semantic role tokens reach for `SwatchGrid`.
