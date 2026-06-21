**FontFamilies** — a stack of font-family rows, each a mono tag, a large sample in the family, and a mono note listing the stack; reach for it to document a type pairing (a UI sans, a code mono).

```tsx
<FontFamilies
  families={[
    { tag: 'Sans · UI', sample: 'The quick brown fox', note: 'Hanken Grotesk, system-ui…' },
    { tag: 'Mono · Code', sample: 'render(case)', note: 'JetBrains Mono…', mono: true },
  ]}
/>
```

This documents which families exist. For size steps reach for `TypeScale`; for weights reach for `WeightSpecimen`.
