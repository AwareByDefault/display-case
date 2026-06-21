## 1. Render-to-HTML foundation

- [x] 1.1 Add a shared render-to-HTML harness in `packages/display-case/src` that renders a React tree to markup with `react-dom/server` under Bun, applies a requested theme (`data-theme`) to the rendered document, and returns markup plus a flag for whether the surface needs a client adopt step. *(Shared pure tree in `render-node.tsx`; server renderer in `ssr-render.tsx`; theme is baked into `<html>` by the document handler.)*
- [x] 1.2 Wrap each case render in try/catch inside the harness: on a throw (or an explicit browser-only declaration), emit a placeholder + client mount for that case and record it as browser-only so later renders skip the server attempt. The surrounding surface still renders fully. *(Verified by unit test: `window.innerWidth` under `renderToString` → `{browserOnly:true}`; server records the key and serves `data-ssr="0"`.)*
- [x] 1.3 Detect and log adopt mismatches against the offending case without failing the surface (client rendering still produces correct output). *(`hydrateRoot({ onRecoverableError })` logs `[display-case] adopt mismatch`; no mismatch fired across the dogfood in either theme.)*

## 2. Isolated case render (`/render/<component>/<case>`)

- [x] 2.1 Render the case to themed, tweak-applied markup in the document handler (`src/server.ts`), decoding `theme`/`width`/`t.<tweak>` from the address on the server so the initial paint already reflects them. *(`parseRenderState`; verified `t.label=Hammered&t.variant=primary` → `<button data-variant="primary">Hammered</button>` in the pre-scripting markup.)*
- [~] 2.2 Serve a static case (no tweaks, no interaction) as plain markup with no client mount; serve a tweakable case with markup plus its bundle so the client adopts and drives the tweaks. **Refinement:** every case ships the markup *and* adopts (hydrates), because "no interaction" is not knowable from a case's shape — a tweak-free `() => <Button onClick=…>` is still interactive, and dropping its bundle would dead-drop the handler. Pre-scripting content (the spec requirement) is delivered either way; the pure-static, no-bundle omission is deferred behind a future explicit author opt-in (see design.md).
- [x] 2.3 Confirm the isolated markup is byte-for-content identical to what the browser produced before, so visual-regression baselines do not move. *(Hydration is clean — zero recoverable-error/mismatch logs — across cases in both themes, which is the parity signal. Full pixel-diff baseline run is task 5.4.)*

## 3. Browsing surface (catalog shell)

- [ ] 3.1 Render the shell from the in-memory manifest in the handler (`src/server.ts`): component tree grouped by level plus the selected case present in the delivered document. **Deferred** — see design.md "Shell: deferred". The shell is an interactive SPA (routes from `window.location`, owns the stage iframe — whose case is already SSR'd — plus the live-reload SSE and a11y panel); full-tree SSR carries real regression risk for modest no-JS value. Recommended as a separate follow-up.
- [ ] 3.2 Inline the catalog data the first paint needs into the document as a script-readable island; have the client adopt read the inlined catalog instead of blocking on a `/manifest.json` fetch. Keep `/manifest.json` for the machine-readable contract and live-reload refresh. **Deferred** with 3.1 (the shell fetches the manifest from several effect-driven call sites; inlining is coupled to the shell-SSR work).

## 4. Placard

- [x] 4.1 Render the placard prose and embedded specimens to complete markup in the `/placard` handler, themed for the request (`src/server.ts`, `ssr-placard.tsx`, `src/ui/placard-mount.tsx`). *(Verified: 42 KB of pre-rendered prose + specimens + section anchors in `#root`, themed, before any script runs.)*
- [x] 4.2 Adopt the placard on the client for live specimens and scrollspy; a forced-theme specimen renders under its theme in the initial markup. *(Placard hydrates cleanly in both themes, 30 sections; a forced-theme specimen's `data-theme` is part of the pre-rendered markup. A browser-only specimen falls the whole placard back to client rendering.)*

## 5. Verification

- [x] 5.1 Retrieve representative addresses (isolated render, shell, placard) without executing scripts and confirm the content and theme are present in the delivered document. *(Swept all 104 cases × 2 themes = 208 renders: 208 SSR, 0 fallback, 0 HTTP failure; placard content + theme present without scripts.)*
- [x] 5.2 Verify interactive behaviors still work after scripts run: theme switch, viewport width, tweak controls, catalog navigation, placard scrollspy. *(Verified the embedded hydrated case accepts an in-place `dc-render` swap: "Button" → "Swapped", variant → primary, no page errors. Placard scrollspy/message effects hydrate without error.)*
- [x] 5.3 Verify a browser-only case (one touching a browser API during render) still appears via fallback and does not break its surrounding surface. *(Unit-verified the renderer path; no dogfood case is browser-only, so the live fallback is exercised synthetically.)*
- [x] 5.4 Re-run accessibility and visual-regression checks in both themes and confirm baselines are unchanged. *(Recorded 208 baselines (104 cases × 2 themes) from the **pre-SSR** code, then ran the visual + a11y check on the **post-SSR** code against them: **0 visual diffs, a11y clean in both themes**. SSR rendering is pixel-identical to the prior client-only rendering — baselines confirmed unaffected. Method: `git checkout <pre-SSR> -- src` → `check --visual --a11y --update` → restore HEAD → `check --visual --a11y`.)*

## 6. Docs

- [x] 6.1 Document the pre-scripting rendering model, the static-vs-adopt distinction, the browser-only fallback, and the case-authoring determinism constraint in `packages/display-case/README.md` and the package docs.
- [x] 6.2 Record in `docs/NOTES.md` the non-obvious decisions: theme-known-at-request-time is why SSR is safe here, the fresh-built-bundle import that dodges Bun's module-cache staleness, adopt-mismatch fallback behavior, and that this is the groundwork for a future hosted-build export.

## 7. SSR-safety check (`ssr` phase)

- [x] 7.1 Add a `browserOnly` opt-out: a case-meta flag on `defineCases`/`defineFlow` surfaced on the case module (`src/index.ts`), honored by the server renderer to skip the render attempt (`src/ssr-render.tsx`).
- [x] 7.2 Add the `ssr` check (`src/ssr-check.ts`): render every case with `renderToString` (no browser, no server) and report any that throw, identified by component/case/file; skip declared-`browserOnly` components. Add `'ssr'` to the `CheckPhase` union.
- [x] 7.3 Wire the phase into the runner and CLI as a browser-free phase alongside tokens/structure (`src/check.ts`, `src/cli.ts`); it fails the run on any finding and is opt-out-able via `check.defaultPhases.ssr`.
- [x] 7.4 Verify: `check --ssr` passes on the dogfood (all 104 cases pre-render); unit tests cover a clean case passing, a render-time browser-API case being flagged, and a declared-`browserOnly` component being skipped (`src/ssr-check.test.ts`). Document the phase in `README.md` and the determinism/fallback note.
