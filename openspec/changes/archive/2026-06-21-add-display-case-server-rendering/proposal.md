## Why

Display Case renders everything in the browser. The server hands back a near-empty HTML shell plus a script bundle; the shell fetches `/manifest.json` and mounts the catalog, and each isolated `/render/<component>/<case>` document only paints its case once its script has run and read the URL. This is fine on localhost with a live discovery server in front of every request, but it is the wrong foundation for the thing we actually want next: a **"build production webapp" feature** that lets a team host their Display Case somewhere beyond one developer's machine — a static or lightly-served site that survives without the dev server doing per-request discovery and bundling.

A page whose content only exists after its own scripts run is slow to first paint, invisible to anything that fetches a URL without executing it (crawlers, link previews, plain `curl`, screenshot tools that capture before scripts settle), and impossible to pre-build into static HTML files. Rendering the content **before the page's scripts execute** removes all of those limits at once, and it is the prerequisite that a future export step needs: if every address already produces a complete document, a build command can simply walk the addresses and write the documents to disk.

This change does that rendering work. It does **not** add the export/deploy command itself — that is the follow-up this unblocks.

## What Changes

- Render the **isolated case document** (`/render/<component>/<case>`) to complete, themed HTML before its scripts run. A viewer or snapshot tool that retrieves the address sees the case content immediately; the page's script only takes over to drive interactive tweaks.
- Render the **placard** prose and its embedded specimens to complete HTML, then layer on the interactive specimens and scrollspy.
- _(Deferred to a follow-up — see design.md "Shell: deferred".)_ Render the **browsing surface** (catalog shell) to complete HTML from the manifest the server already holds, and inline that catalog so the first paint no longer waits on a separate `/manifest.json` round-trip. The shell is an interactive SPA (routes from the URL, owns the stage iframe — whose case is already pre-rendered — plus the live-reload stream and a11y panel); its no-JS value is modest and the regression risk real, so it ships separately.
- **Gracefully fall back to in-browser rendering** for any case that cannot render outside a browser (one that touches browser-only APIs while rendering, or is explicitly marked browser-only). Such a case still appears and the surrounding surface still renders fully — the rest of the page does not break because one case is browser-bound.
- **Add an `ssr` check** that renders every case on the server and fails when a case can't pre-render — turning "keep render pure; browser APIs belong in effects/handlers" into an enforced best practice. It is a precise, zero-false-positive alternative to a static "no browser APIs" lint (which would wrongly flag legitimate effect/handler usage): it tests the one thing that matters — does this case pre-render? A component that genuinely needs a browser opts out by declaring itself **browser-only** (a new case-meta flag), which also drives its client-render fallback.
- Keep every address, snapshot, theme, viewport, and tweak behaving exactly as before. The delivered markup for an isolated render is the same content it produced in the browser, so visual-regression baselines are unaffected.

This is largely an enhancement to **how the existing surfaces are produced** — addresses, routes, snapshots, and themes are unchanged. The only new author-facing surface is the opt-in `browserOnly` case-meta flag and the `ssr` check phase. Display Case remains a development-only tool today (the hosted-build feature is a separate, later change).

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `display-case`: the isolated case render and the placard now deliver their content already rendered and themed before the page's own scripts execute, with automatic fallback to in-browser rendering for cases that cannot render outside a browser. A new `ssr` check fails on any case that can't pre-render unless its component is declared browser-only. Addresses, themes, viewports, tweaks, and snapshot output are unchanged.

## Impact

- **Spec**: `openspec/specs/display-case/spec.md` — adds "Pre-scripting rendered content" and "Server-render safety check".
- **Package** `packages/display-case`: a shared pure tree builder (`src/render-node.tsx`) used by both server and client; the server case/placard renderers + their per-rebuild fresh-bundle wiring (`src/ssr-render.tsx`, `src/ssr-placard.tsx`, codegen in `src/discovery.ts`, build/handlers in `src/server.ts`); the client mounts adopt pre-rendered markup (`src/ui/render-mount.tsx`, `src/ui/placard-mount.tsx`); the `ssr` check (`src/ssr-check.ts`, wired in `src/check.ts` and `src/cli.ts`); the `browserOnly` case-meta flag and the `ssr` `CheckPhase` (`src/index.ts`). The shell (`browser-entry`/`shell.tsx`) is deferred — see `design.md`.
- **Snapshots & checks**: visual-regression baselines are unaffected because the rendered content is identical; accessibility, token, and structure checks are unchanged; the new `ssr` phase runs browser-free alongside tokens/structure.
- **Consumers**: no configuration change and no author action required. Existing showcases gain pre-rendered content automatically. A case that relied on running in a browser to render continues to work via the fallback.
- **No production application artifact is affected** — Display Case stays out of every deployed app build, exactly as today.
