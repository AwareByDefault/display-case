**Sidebar** — the nav rail: a scrolling, hairline-bordered column on the subtle backdrop that holds the component tree; reach for it as the ground `NavItem` rows sit on (rows are transparent and only read correctly against this surface).

```tsx
<Sidebar label="Components">
  <NavItem kind="component" label="Button" count={4} expanded onToggle={toggle} />
  <NavItem kind="case" label="Variants" current onSelect={select} />
</Sidebar>
```

Layout (grid placement, collapse) stays the chrome's; the surface is the component's.

- **label**: accessible name for the `<nav>` landmark; pass the contextual name (default `"Navigation"` is a generic fallback)
- **children**: `NavItem` rows (typically grouped by hierarchy level)
- spreads remaining props onto the `<nav>`
