**NavItem** — one row in the sidebar tree; reach for it to render a component or case entry in the navigation.

```tsx
<NavItem kind="component" label="Button" count={4} expanded
  onToggle={toggle} onSelect={select} />
<NavItem kind="case" label="Variants" current onSelect={select} />
```

`kind="component"` (the default) renders a disclosure chevron + name + optional case `count`; `kind="case"` renders an indented case link aligned under the component name. The chevron and `onToggle` exist only for `kind="component"`. The active row (`current`) is marigold with a left tick.

Place inside `Sidebar`.

`onSelect` (name click) and `onToggle` (chevron click) are argument-less. A11y: component rows expose `aria-expanded` with a dynamic Expand/Collapse label; the name button gets `aria-current` when `current`.
