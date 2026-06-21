**SelectMenu** — an accessible custom single-select (WAI-ARIA "select-only combobox"): a styled trigger that opens a popup listbox. Looks like `Select`, but commits the picked value **instantly** with no native OS popup — reach for it when the choice drives a live view that must update the moment an option is clicked.

```tsx
<SelectMenu
  aria-label="variant"
  options={['primary', 'ghost', 'bare']}
  value={variant}
  onChange={setVariant}
/>
```

Controlled only: pass `value` and an `onChange(value: string)` (the value, **not** an event — unlike `Select`). `options` are plain strings or `{ value, label }` for a display label that differs from the stored value.

Why it exists: a native `<select>` on macOS defers its `change` event until the OS dropdown finishes dismissing, which visibly lags any live-updating preview. `SelectMenu` avoids that. Prefer the simpler **`Select`** (native) when there's no live binding, or when you need `<optgroup>` grouping (SelectMenu is flat).

Accessibility: focus stays on the `role="combobox"` trigger; the active option is tracked via `aria-activedescendant`. Full keyboard parity with a native select — ↑/↓ move, Home/End jump, type-ahead matches by label, Enter/Space commit, Esc cancels, Tab commits then moves on. The popup portals to `document.body`, so an `overflow`-clipping or `position: fixed` ancestor won't trap it.

Sizes: `sm` · `md` (default). `disabled` skips interaction and drops it from the tab order.
