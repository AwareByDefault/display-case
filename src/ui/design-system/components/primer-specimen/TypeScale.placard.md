**TypeScale** — a column of type-size rows, a mono tag beside a live sample rendered at the
step's size. A reusable Primer specimen for documenting a type scale at its
real sizes.

```tsx
<TypeScale
  steps={[
    { tag: 'lg · 20', size: '20px', sample: 'Section title' },
    { tag: 'base · 14', size: '14px', sample: 'Body baseline' },
  ]}
/>
```

Use this for size steps. For weights reach for `WeightSpecimen`; for which families exist reach for `FontFamilies`.
