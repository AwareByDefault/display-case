**A11yBadge** — the nav-rail accessibility marker: a small danger pill carrying a violation count, or a bare dot. [NavItem](./NavItem.placard.md) renders it from its `alert` prop; reach for it directly only when building a custom nav row.

```tsx
<A11yBadge value={3} />        {/* counted pill */}
<A11yBadge value="dot" />      {/* bare dot — no number */}
```

- `value` — a positive number renders the counted pill; `'dot'` renders the unnumbered dot. Use `'dot'` on an **expanded** component whose per-variant counts have moved onto its case rows, so the parent still flags "issues here" without competing with the child numbers. The caller decides whether to render it at all (omit for a clean / unmarked row — there is no zero state).
- `testId` — optional `data-testid` for locating the marker in tests.

It carries an accessible name (`"N accessibility violations"`) via `role="img"`, so the count is announced even though it reads as a glyph.
