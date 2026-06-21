**RenderAddress** — a monospace address bar with an HTTP method tag, a URL that scrolls if it overflows, and a copy button; reach for it to show a deterministic render URL (or any endpoint) the reader can copy.

```tsx
<RenderAddress method="GET" url="/render/button/playground?theme=light" />
```

Clicking the button copies `url` to the clipboard, flips the glyph to ✓ for ~1.2s, then reverts. It degrades silently when the clipboard is unavailable (e.g. an isolated frame) — the address still reads.
