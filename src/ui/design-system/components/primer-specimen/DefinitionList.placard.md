**DefinitionList** — a bordered list of term / description rows, the term a mono uppercase accent eyebrow; reach for it to lay out voice rules, content fundamentals, or any keyed reference prose.

```tsx
<DefinitionList
  termWidth="7.5rem"
  entries={[
    { term: 'Voice', description: 'Plain, confident, technical-but-warm.' },
    { term: 'Casing', description: <>Sentence case, except the <strong>eyebrow</strong>.</> },
  ]}
/>
```

Use this for free-form prose keyed by a term. For a fixed legend of dot-keyed statuses, reach for `StatusList`.

`description` accepts rich nodes (`<strong>` and other emphasis welcome), not just plain text.
