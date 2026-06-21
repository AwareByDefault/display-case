**IconButton** — a square control carrying a single Unicode glyph (☰ ⟲ ✕ ＋ −); reach for it for compact, glyph-only chrome actions. Display Case uses no icon font and no SVG — just glyphs.

```tsx
<IconButton glyph="☰" label="Toggle navigation" />
<IconButton glyph="⟲" label="Rotate" variant="bare" />
<IconButton glyph="▭" label="Dock" active />
```

`label` is required — it is the accessible name, since the button shows no text. Variants: `outline` (default) · `bare` (no border).

`active` is persistent emphasis (a row that stays lit); `aria-pressed` is a true toggle (on/off). Both light marigold. For text or labelled actions, use `Button`.

It is a real `<button>` — pass `disabled`, `onClick`, etc.
