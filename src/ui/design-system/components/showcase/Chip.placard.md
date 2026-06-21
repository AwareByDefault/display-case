**Chip** — a small pill for hierarchy levels (atom, molecule…), flow steps, tweak tokens, and counts; reach for it to tag or label one item compactly. Static by default; pass `onClick` and it becomes a button.

```tsx
<Chip>atom</Chip>
<Chip variant="accent">accent</Chip>
<Chip index={2} current onClick={() => goto('check-email')}>Check email</Chip>
```

Variants: `default` (muted) · `accent` (marigold outline, soft fill) · `solid` (filled ink, for the one chip that must stand out against the others). `current` is the marigold "active" state; `index` prepends a dimmed mono number.

For a multi-step stepper, reach for `FlowNav`.

Pass `label` for the accessible name: with `onClick` (button form) it becomes `aria-label`; without (span form) it becomes the `title`. `onClick` emits nothing — the caller already knows which chip it wired.
