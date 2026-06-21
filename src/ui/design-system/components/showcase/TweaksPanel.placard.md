**TweaksPanel** — groups a case's tweak controls into one bordered card (Display Case never floats controls — except this panel itself); reach for it to expose a case's live tweaks. Mono label left, control right.

```tsx
<TweaksPanel
  title="Tweaks"
  url="?t.kind=number&t.disabled=1"
  mode={floating ? 'floating' : 'docked'}
  onToggleMode={toggle}
  items={[
    { label: 'kind', control: <Select options={['text', 'number']} /> },
    { label: 'disabled', control: <input type="checkbox" /> },
  ]}
/>
```

Modes: `docked` (default, beneath the stage) · `floating` (a free, draggable overlay — the one sanctioned floating surface, so it earns the overlay shadow; drag the head to roam over the nav, header, docs). `onToggleMode` renders the dock/float toggle.

- **items**: `{ label, control }[]` — or compose `<Row label>…</Row>` children (the exported per-row component; one `TweakControl` per row)
- **title**: header label (defaults `'Tweaks'`)
- **url**: the encoded, shareable tweaked-state URL
