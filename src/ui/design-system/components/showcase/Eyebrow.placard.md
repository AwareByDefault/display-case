**Eyebrow** — the signature section label: uppercase JetBrains Mono, wide tracking, muted; reach for it to mark a group header or panel title in the chrome.

```tsx
<Eyebrow>Components</Eyebrow>
<Eyebrow tone="accent">Tweaks</Eyebrow>
```

Renders a `<div>` by default. Override `as="span"` only when the label sits inline inside other text (a block `<div>` would break the flow).

Tones: `muted` (default) · `accent` (marigold) · `strong` (full ink).
