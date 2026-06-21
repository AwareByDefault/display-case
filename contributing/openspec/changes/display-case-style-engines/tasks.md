## 1. Spike & de-risk client adoption (isolated render only)

- [x] 1.1 Add `StyleEngine` / `StyleCollector` types and `styleEngines?: StyleEngine[]` to `DisplayCaseConfig` in `src/index.ts`; add `headStyles?: string` to `CaseHtmlResult` in `src/render/ssr-render.tsx`.
- [x] 1.2 In `renderCaseToHtml` (`ssr-render.tsx`), inside the already-rendered branch (and inside the `try`): map `config.styleEngines` to collectors, `wrap` the tree in array order, `renderToString`, then concatenate each collector's `collect(html)` into `headStyles`. (Factored into `src/render/collect-styles.ts` `renderWithStyles`, shared with the primer.)
- [x] 1.3 Add a discrete `headStyles` slot to the dev `renderHtml` builder (`src/server/server.ts`) — emitted after the base `<style>` block, before `</head>` — and thread `result.headStyles` from the `/render` route into it.
- [~] 1.4 Authored the flagship `emotionEngine` recipe (in `docs/style-engines.md` / `design.md`) and validated the **server-side** seam end-to-end with a stub engine: `wrap` is applied, `collect` output lands as a discrete `<head>` tag in the served document (scripts-disabled), per-render isolation holds. **Deferred:** real-emotion/MUI **client adoption** in a browser — that requires adding MUI/emotion, which the design rules out as a tool dependency; it is validated in a consuming repo via the documented recipe.

## 2. Primer path

- [x] 2.1 Add `headStyles?` to the primer render result and apply the same collect-around-render in `renderPrimerToHtml` (`src/render/ssr-primer.tsx`). (`makePrimerRenderer` now takes `config`; the SSR-primer codegen imports it.)
- [x] 2.2 Add the discrete `headStyles` slot to the dev `primerHtml` builder (`server.ts`) and thread it from the primer route.

## 3. Prod / publish path

- [x] 3.1 Add an optional `headStyles` param to `renderDoc` and `primerDoc` in `src/render/documents.ts` (same discrete-slot placement as dev).
- [x] 3.2 Thread `headStyles` through `src/server/prod-server.ts` `documentFor` (and `src/commands/publish.ts` SSR-primer codegen passes `configPath`) so `publish` and `publish --static` emit it identically to dev. Shell document untouched (it iframes `/render`).

## 4. Isolation, optionality & browser-only

- [x] 4.1 Confirm the engine factory is invoked **once per render** (fresh store each time), so one case's styling never appears in another's document. (`renderWithStyles` maps `engines → make()` per call; covered by `collect-styles.test.tsx` + `ssr-render.test.tsx` distinct-instance-id assertions.)
- [x] 4.2 Confirm a `browserOnly` case short-circuits before any engine runs and emits no `headStyles`; the surrounding surface is unaffected. (Guard precedes the `try`; `ssr-render.test.tsx` asserts `headStyles` undefined.)
- [x] 4.3 Confirm that with `styleEngines` absent/empty the rendered documents are byte-identical to before this change (inert-when-unused). (`documents.test.ts`: `doc({})` === `doc({ headStyles: '' })`.)

## 5. Tests

- [x] 5.1 Unit: a configured engine's `wrap` is applied and its `collect` output lands in the isolated-render document head (and not inside the base `<style>` block). (`collect-styles.test.tsx` + `documents.test.ts` placement assertion `</style>${tag}</head>`.)
- [x] 5.2 Unit: two cases with different render-time styling get per-render-isolated head styling (no cross-bleed). (`ssr-render.test.tsx`.)
- [x] 5.3 Unit: no engines ⇒ identical document; `browserOnly` case ⇒ empty `headStyles`. (`documents.test.ts` + `ssr-render.test.tsx`.)
- [x] 5.4 Type test (`*.test-d.ts`): `StyleEngine` / `StyleCollector` shape and the `styleEngines` field type. (`src/style-engine.test-d.ts`.)

## 6. Verification

- [x] 6.1 `bun run lint` and `bun run typecheck` clean.
- [x] 6.2 `bun run check` (structure + tokens + ssr) passes.
- [x] 6.3 `bun test` passes (335 tests).
- [x] 6.4 `bun run e2e` (chrome suite) passes — 24/24, no regression in the iframed render.
- [~] 6.5 Manual flagship **MUI** render verification (scripts disabled, light + dark) is **deferred** to a consuming repo: it requires MUI/emotion, which the design excludes as a tool dependency. The `server-rendering` scenarios are covered structurally by the stub-engine tests (styling present pre-script, isolation, browser-only exemption, inert-when-unused).

## 7. Documentation

- [x] 7.1 Author `docs/style-engines.md` from the `design.md` appendix (emotion/MUI flagship, styled-components, the static-CSS/zero-runtime/browser-only "when you don't need it" guidance, and the custom-engine contract).
- [x] 7.2 `docs/configuration.md` — add a `styleEngines` row to the reference table and a `### styleEngines` section; cross-link the `decorator` ↔ `styleEngines` pairing.
- [x] 7.3 `docs/theming.md` — add a short "Render-time styling (CSS-in-JS / MUI)" note pointing to `style-engines.md`, alongside the existing Global styles / Decorator sections; add it to the page nav rows.
- [x] 7.4 `README.md` — update the framework-support framing so MUI/emotion is a supported, pre-scripting-styled path (style engine), not a caveat.
- [x] 7.5 `contributing/NOTES.md` — record the per-render-factory isolation rule, the discrete-head-slot (don't fold into the base `<style>`) requirement for client adoption, and the `styleEngines` (server) ↔ `decorator` (client) pairing.
- [x] 7.6 `contributing/openspec/config.yaml` — add **style engine** to the domain vocabulary and note the seam under the `server-rendering` capability line.
