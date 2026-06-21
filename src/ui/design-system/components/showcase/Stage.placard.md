**Stage** — the vitrine: the framed surface a component is exhibited on (hairline border, soft corner ticks, optional dotted grid, optional mono caption); reach for it to present one component. Keep it quiet — the exhibit leads.

The browse chrome's preview stage, sized by `frame` rather than centering a card. `frame="hug"` shrinks to the exhibit with a minimum size and a dynamic grid margin (`padX`/`padY`, in px); `frame="fill"` stretches edge-to-edge for full pages.

```tsx
<Stage frame="hug" padX={48} padY={32} surface="var(--color-bg)">
  <App />
</Stage>
```

- **frame** (required): `hug` (shrink to the exhibit) · `fill` (stretch edge-to-edge)
- **caption** / **meta**: mono caption strip (label left, meta right)
- **grid**: dotted graph-paper backdrop · **corners**: corner ticks (default on)
- **padX** / **padY**: dynamic grid-margin padding (px) for `frame="hug"`
- **surface**: override the body backdrop colour
