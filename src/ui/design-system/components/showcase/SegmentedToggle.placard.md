**SegmentedToggle** — an isolated, multi-option segmented control; reach for it whenever you're switching between a small fixed set of mutually-exclusive views or modes (2, 3, 5 — any count) and want the selection to slide rather than blink.

```tsx
<SegmentedToggle
  label="View mode"
  options={[
    { id: 'primer', label: 'Primer' },
    { id: 'library', label: 'Cases' },
  ]}
  value={mode}
  onChange={setMode}
/>
```

It's controlled: pass `value` (one option's `id`) and `onChange`. A single brand-filled thumb is sized to one cell and translated by the active index, so the highlight animates **linearly across the list** for any number of options — there is no per-count CSS. The geometry is driven by `--seg-count` / `--seg-index` set inline on the root; the transition respects `prefers-reduced-motion`.

`label` is the tablist's accessible name (the control is `role="tablist"`, each segment `role="tab"`). Options render in array order. An unknown `value` parks the thumb on the first cell.

Pass `testId(id)` for per-segment `data-testid`s (the sidebar mode switch uses `DcTestIds.modeSwitch`). Pass `className` for layout-context placement (e.g. the sidebar adds `dc-modeswitch` for pinning); the control's own appearance stays self-contained.

For a single pill, reach for `Chip`; for a stepper with Prev/Next, `FlowNav`.
