**SpacingScale** — a column of spacing rows, each a mono token tag, its resolved value, and a bar whose width visualises the step; reach for it to show a spacing scale to scale.

```tsx
<SpacingScale
  steps={[
    { token: 'space-4', value: '8px', width: 8 },
    { token: 'space-8', value: '16px', width: 16 },
  ]}
/>
```

`value` (the display string) and `width` (the bar length in px) are independent inputs the caller keeps in sync — neither is derived from the other, so a mismatch will silently render a misleading bar.
