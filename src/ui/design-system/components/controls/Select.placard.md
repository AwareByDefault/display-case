**Select** — a native `<select>` styled to match the chrome (mono `▾` caret); reach for it to pick one value from a fixed set of choices.

```tsx
<Select options={['text', 'number', 'boolean']} value={kind} onChange={(e) => setKind(e.target.value)} />
<Select options={[
  { label: 'Responsive', options: ['Full', 'Desktop'] },
  { label: 'Devices', options: ['iPhone 14', 'iPad'] },
]} />
```

`onChange` emits a native `<select>` event — read `event.target.value`. Accepts plain options, grouped options, or arbitrary `<option>` children.

For free-form text or number entry, use `Input`.

Sizes: `sm` · `md` (default). Other native `<select>` props (`value`, `disabled`, …) spread onto the element.
