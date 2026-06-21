**FlowNav** — the stepper for multi-step flows: numbered step chips plus Prev/Next, grouped on one bar; reach for it when a flow's steps are individually addressable.

```tsx
<FlowNav
  steps={[{ id: 'a', label: 'Request link' }, { id: 'b', label: 'Check email' }]}
  activeId="a"
  onSelect={(id) => goto(id)}
/>
```

`onSelect(id)` fires from both chip clicks and the Prev/Next buttons. Prev/Next resolve to the neighboring step's `id` (not a delta or direction), so the handler is always "go to this step". They auto-disable at the first and last step.

For a single pill, reach for `Chip`.
