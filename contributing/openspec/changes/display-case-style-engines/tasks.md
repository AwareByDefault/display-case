## 1. Spike & de-risk client adoption (isolated render only)

- [ ] 1.1 Add `StyleEngine` / `StyleCollector` types and `styleEngines?: StyleEngine[]` to `DisplayCaseConfig` in `src/index.ts`; add `headStyles?: string` to `CaseHtmlResult` in `src/render/ssr-render.tsx`.
- [ ] 1.2 In `renderCaseToHtml` (`ssr-render.tsx`), inside the already-rendered branch (and inside the `try`): map `config.styleEngines` to collectors, `wrap` the tree in array order, `renderToString`, then concatenate each collector's `collect(html)` into `headStyles`.
- [ ] 1.3 Add a discrete `headStyles` slot to the dev `renderHtml` builder (`src/server/server.ts`) — emitted after the base `<style>` block, before `</head>` — and thread `result.headStyles` from the `/render` route into it.
- [ ] 1.4 Author the flagship `emotionEngine` (per `design.md`) against a scratch MUI case; verify `/render/<comp>/<case>?theme=dark` fetched **with scripts disabled** is fully styled, and **with** scripts there is no flash and no duplicated `<style data-emotion>` tag (client adoption works). This validates the core claim before wider wiring.

## 2. Primer path

- [ ] 2.1 Add `headStyles?` to the primer render result and apply the same collect-around-render in `renderPrimerToHtml` (`src/render/ssr-primer.tsx`).
- [ ] 2.2 Add the discrete `headStyles` slot to the dev `primerHtml` builder (`server.ts`) and thread it from the primer route.

## 3. Prod / publish path

- [ ] 3.1 Add an optional `headStyles` param to `renderDoc` and `primerDoc` in `src/render/documents.ts` (same discrete-slot placement as dev).
- [ ] 3.2 Thread `headStyles` through `src/server/prod-server.ts` `documentFor` (and any `src/commands/publish.ts` document construction) so `publish` and `publish --static` emit it identically to dev. Confirm the shell document is untouched (it iframes `/render`).

## 4. Isolation, optionality & browser-only

- [ ] 4.1 Confirm the engine factory is invoked **once per render** (fresh store each time), so one case's styling never appears in another's document.
- [ ] 4.2 Confirm a `browserOnly` case short-circuits before any engine runs and emits no `headStyles`; the surrounding surface is unaffected.
- [ ] 4.3 Confirm that with `styleEngines` absent/empty the rendered documents are byte-identical to before this change (inert-when-unused).

## 5. Tests

- [ ] 5.1 Unit: a configured engine's `wrap` is applied and its `collect` output lands in the isolated-render document head (and not inside the base `<style>` block).
- [ ] 5.2 Unit: two cases with different render-time styling get per-render-isolated head styling (no cross-bleed).
- [ ] 5.3 Unit: no engines ⇒ identical document; `browserOnly` case ⇒ empty `headStyles`.
- [ ] 5.4 Type test (`*.test-d.ts`): `StyleEngine` / `StyleCollector` shape and the `styleEngines` field type.

## 6. Verification

- [ ] 6.1 `bun run lint` and `bun run typecheck` clean.
- [ ] 6.2 `bun run check` (structure + tokens + ssr) passes.
- [ ] 6.3 `bun test` passes.
- [ ] 6.4 `bun run e2e` (chrome suite) passes — no regression in the iframed render.
- [ ] 6.5 Manually fetch the flagship MUI render with scripts disabled (light + dark) and confirm full styling and theme correctness (the `server-rendering` scenarios).

## 7. Documentation

- [ ] 7.1 Author `docs/style-engines.md` from the `design.md` appendix (emotion/MUI flagship, styled-components, the static-CSS/zero-runtime/browser-only "when you don't need it" guidance, and the custom-engine contract).
- [ ] 7.2 `docs/configuration.md` — add a `styleEngines` row to the reference table and a `### styleEngines` section; cross-link the `decorator` ↔ `styleEngines` pairing.
- [ ] 7.3 `docs/theming.md` — add a short "Render-time styling (CSS-in-JS / MUI)" note pointing to `style-engines.md`, alongside the existing Global styles / Decorator sections; add it to the page nav rows.
- [ ] 7.4 `README.md` — update the framework-support framing so MUI/emotion is a supported, pre-scripting-styled path (style engine), not a caveat.
- [ ] 7.5 `contributing/NOTES.md` — record the per-render-factory isolation rule, the discrete-head-slot (don't fold into the base `<style>`) requirement for client adoption, and the `styleEngines` (server) ↔ `decorator` (client) pairing.
- [ ] 7.6 `contributing/openspec/config.yaml` — add **style engine** to the domain vocabulary and note the seam under the `server-rendering` capability line.
