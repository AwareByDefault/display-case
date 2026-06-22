---
name: display-case-snapshot
description: >
  Render and screenshot a single component variant in isolation, in light and
  dark themes, without booting the app. Use when asked to "show me <component>",
  "screenshot a component", "what does <case> look like", or to capture a
  component's appearance for review. Drives the Display Case dev server's
  chrome-free /render endpoint.
---

Capture one component case as an image, deterministically, via Display Case.

## Steps

1. **Ensure the server is running.** Start it if needed: `bun run display-case` (serves at `http://localhost:3100`). It needs no database or app — just the showcase.
2. **Enumerate.** `GET http://localhost:3100/manifest.json` (or `bunx @awarebydefault/display-case <pkgDir> --print-manifest`, no server needed) to find the component and its cases. Each case has a `renderUrl` like `/render/tweak-control/playground` and an optional `tweaks` schema.
3. **Build the render URL.** Append query params to pin the exact state:
   - `theme=light|dark`
   - `width=<px>` (optional, constrains to a centered max-width)
   - `t.<name>=<value>` per tweak (`boolean`→`1`/`0`; `number`→numeric; text/choice verbatim)
   - e.g. `http://localhost:3100/render/tweak-control/playground?theme=dark&t.kind=choice`
4. **Rasterize.** The endpoint returns chrome-free **HTML**, so capture it with a headless browser (Playwright `page.goto(url); page.screenshot()`). Capture both `theme=light` and `theme=dark` unless told otherwise.
5. **Report** the screenshots and the exact URLs used, so the state is reproducible.

## Notes

- The render is isolated (its own document, `data-theme` on the root), so it never includes the browse sidebar/controls — ideal for clean snapshots.
- Same URL → same render. Pin tweaks in the URL rather than interacting with the page.
- For the full contract see `../../docs/ai-agents.md`.
