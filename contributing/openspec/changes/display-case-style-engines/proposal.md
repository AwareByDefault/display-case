## Why

Display Case delivers every surface **rendered and styled before scripts run**
(the `server-rendering` promise). That promise holds for two styling models:
static stylesheets listed in `globalStyles`, and the Vitrine's own co-located
component CSS — both are read and inlined into the document head server-side.

It does **not** hold for a third, very common model: **render-time styling**,
where a component emits its CSS as a side effect of rendering rather than from a
static sheet. This is how emotion (and therefore **Material UI**, its default
styling engine), styled-components, goober, and similar runtime CSS-in-JS
libraries work. Under server rendering, `renderToString` discards the styles
those libraries accumulate during the render — Display Case keeps the markup but
throws the styling away. The result for a MUI-based showcase:

- The isolated `/render` snapshot comes back structurally present but **unstyled**
  when retrieved without executing scripts — undermining the
  machine-readable-snapshot guarantee.
- On a live surface the component paints unstyled, then the client runtime
  injects styles — a **flash of unstyled content**, exactly what the
  server-rendering spec forbids.

There is no seam to do the two things these libraries need: give each render an
**isolated style store**, and **pull the collected styling back out** into the
document head before scripting. A consumer can already supply a client-side
provider through `decorator`, which makes MUI *work* — but with the flash,
because nothing extracts the server render's critical CSS.

Today's only escape is to mark such components `browserOnly`, which forfeits
server rendering (and snapshots) entirely. That is a capitulation, not support.

## What Changes

- Introduce a **style-engine seam**: an optional, ordered set of style engines a
  showcase can configure. Each engine, per server render, wraps the rendered
  tree in whatever provider its library needs (so render-time styling
  accumulates in an isolated, per-render store) and then, given the rendered
  markup, returns the head styling that render used.
- Thread the collected head styling through the **isolated render** and the
  **primer** documents (the two surfaces that render consumer components
  in-document) so render-time styling is delivered **before scripting**, on the
  server, deterministically — closing the flash and restoring the styled
  snapshot. The browse shell embeds cases via a live `/render` iframe, so it
  inherits this through the render document and needs no separate wiring.
- Keep the seam **per-render isolated** (one case's render-time styling never
  leaks into another's document) and **inert when unused** (a showcase that
  configures no engines is byte-for-byte unaffected).
- Preserve **client adoption without duplication**: the styling delivered for a
  render is structured so the library's client runtime adopts it instead of
  re-injecting — no flash, no duplicate `<style>`, no restyle. (For emotion with
  its default cache key this is automatic; the flagship recipe relies on it.)
- A `browserOnly` case stays exempt — its styling, like its content, is produced
  in the client.
- Ship the **authoring documentation** with **emotion / Material UI as the
  flagship example**: a complete, copy-pasteable recipe pairing a style engine
  (server-side extraction) with a `decorator` (the client/SSR `ThemeProvider`),
  plus the general contract for any emotion-like library.

This is dependency-light by construction: Display Case takes on **no** runtime
dependency on emotion, MUI, or any styling library. The seam is a small typed
contract; the per-library wiring is a few lines of consumer code (documented as
a recipe), kept out of the tool — consistent with "the showcased component owns
the visual weight" and "stay dependency-light."

## Capabilities

### New Capabilities

- _None as a separate capability._ The seam is an extension of how the existing
  `server-rendering` capability delivers styling before scripting; its observable
  behavior is specified there (a new requirement, **Render-time style
  collection**).

### Modified Capabilities

- `server-rendering`: add a requirement that styling produced as a side effect of
  rendering — not just styling declared in static stylesheets — SHALL be
  collectible during the pre-scripting render and delivered before scripting,
  with per-render isolation, client adoption without duplication, optionality
  when unused, and exemption for browser-only cases. This makes the existing
  "styling present without executing scripts" promise hold for runtime CSS-in-JS
  (MUI/emotion) instead of silently failing for it.

## Impact

- **Affected code (additive; no behavior change when unused):**
  - `src/index.ts` — new exported `StyleEngine` / `StyleCollector` types and a
    `styleEngines?: StyleEngine[]` field on `DisplayCaseConfig`.
  - `src/render/ssr-render.tsx` — apply configured engines around the case tree
    before `renderToString`; return the collected head styling on
    `CaseHtmlResult`.
  - `src/render/ssr-primer.tsx` — the same collection around the primer render.
  - `src/render/documents.ts` and `src/server/server.ts` — a new optional
    head-styling slot in the isolated-render and primer documents (dev host +
    prod/publish builders), emitted as discrete head markup (not folded into the
    base `<style>` block, so library hydration markers survive).
- **No public-surface coupling beyond the new config field/types:** `./tokens-check`
  and `./prod-server` exports are untouched; no consuming-app code, runtime, or
  state is pulled into the tool; the seam is never bundled into a consumer build.
- **Surfaces that benefit:** `render-endpoint` (MUI/emotion snapshots become
  styled pre-script) and the visual-regression / SSR checks (no longer racing
  client style injection).
- **Docs (new developer-facing workflow):** a new `docs/style-engines.md`
  authoring guide with the emotion/MUI flagship recipe; cross-links from
  `docs/theming.md` and `docs/configuration.md` (the `decorator` ↔ `styleEngines`
  pairing); `README.md` (framework-support note); `contributing/NOTES.md` (the
  per-render isolation + client-adoption rationale); and `openspec/config.yaml`
  (the new **style engine** domain concept). The full guide text is drafted in
  this change's `design.md` appendix.
