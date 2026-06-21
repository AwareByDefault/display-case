**WeightSpecimen** — a row of weight samples, each word set at its own font-weight over a mono
caption. A reusable Primer specimen for showing the weights a system uses and
what each is for. An optional `footer` slot hangs extra content (a divider, an
eyebrow sample) below the row.

```tsx
<WeightSpecimen
  weights={[
    { weight: 400, name: 'Normal', role: 'body' },
    { weight: 600, name: 'Semibold', role: 'titles' },
  ]}
/>
```

Use this for weights. For size steps reach for `TypeScale`; for which families exist reach for `FontFamilies`.
