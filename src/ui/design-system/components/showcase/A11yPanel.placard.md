**A11yPanel** — the stage's accessibility verdict for the variant on the stage. A height-capped, internally-scrolling card with a sticky header; it composes [Eyebrow](./Eyebrow.placard.md), [IconButton](../controls/IconButton.placard.md), and [ImpactTag](./ImpactTag.placard.md).

```tsx
<A11yPanel violations={violations} onRescan={() => refetch()} />
<A11yPanel violations="pending" />
<A11yPanel violations={[]} />          {/* clean pass */}
<A11yPanel violations="unavailable" />
```

`violations` drives the whole component — one of four states:

- `'pending'` — a calm, pulsing **Scanning…** bar (single bar, no controls).
- `'unavailable'` — the scan prerequisite can't run; a neutral **Unavailable** bar.
- `[]` — a green **Passes WCAG A/AA** bar.
- `A11yViolation[]` — a danger bar plus a collapsible list, ordered worst-first (by `impact`, then node count), each row tagged with an `ImpactTag`.

Only the violations state has a body to expand/collapse; the others are a single self-explaining bar. Pass `onRescan` to show the ⟳ re-scan control (hidden while pending, and absent entirely when no handler is wired).

The panel is otherwise full-width and `flex: 0 0 auto`, so place it in a sized column. In the chrome it's mounted only when a11y scanning is configured, beneath the Tweaks panel.
