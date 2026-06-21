**ImpactTag** — a severity tag for an accessibility violation, colour-graded by axe `impact` so the worst findings read hottest. Used in the [A11yPanel](./A11yPanel.placard.md) violation list.

```tsx
<ImpactTag impact="critical" />
<ImpactTag impact="serious" />
```

`impact` is one of `critical` · `serious` · `moderate` · `minor` (the `A11yImpact` type). critical is the deepest red, minor the calmest.

The companion `impactRank(impact)` returns a sort key (worst = 0, unclassified last) — sort a violation list with it before mapping each to a tag:

```tsx
[...violations].sort((a, b) => impactRank(a.impact) - impactRank(b.impact))
```
