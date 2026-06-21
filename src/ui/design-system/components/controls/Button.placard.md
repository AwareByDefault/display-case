**Button** — the quiet, bordered text control the Display Case chrome leans on; reach for it for any labelled action.

```tsx
<Button>Docs</Button>
<Button variant="primary">Run check</Button>
<Button variant="accent">Send magic link</Button>
<Button aria-pressed>Grid</Button>
```

Variants: `ghost` (default, recedes) · `primary` (warm ink, the emphatic action) · `accent` (marigold, rare standout) · `subtle` (borderless). A toggle button lights marigold when you pass `aria-pressed`.

For a glyph-only square control, reach for `IconButton`.

It is a real `<button>` — pass `disabled`, `onClick`, `aria-pressed`, etc.
