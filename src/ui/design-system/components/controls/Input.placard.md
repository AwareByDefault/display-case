**Input** — a single-line text/number field with optional mono `prefix`/`suffix` affixes sitting inside the bordered, marigold-focus box (e.g. the device-dimension fields, `1280 × 800`).

```tsx
<Input placeholder="filter by name" value={q} onChange={(e) => setQ(e.target.value)} />
<Input type="number" prefix="W" suffix="px" defaultValue={1280} />
```

`onChange` emits a native event — read `event.target.value`. Controlled via `value` + `onChange`; uncontrolled via `defaultValue`. It renders no label: the caller supplies a `<label>` or `aria-label`.

For a fixed set of choices, use `Select`.

Sizes: `sm` · `md` (default). Use `wrapperStyle`/`wrapperClassName` to size the field box; other native `<input>` props spread onto the inner input.
