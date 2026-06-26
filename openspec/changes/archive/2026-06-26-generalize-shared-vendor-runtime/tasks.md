# Tasks

Three independently shippable phases (each its own PR + changeset). Phase 1 ships
under the existing `publishing` spec (output is byte-identical); Phases 2–3 land the
new/modified requirements in this proposal.

## Phase 1 — Generalize the mechanism, React-only default (no behavior change) (D1, D2, D3)

- [x] 1.1 Introduce a `SharedLib` descriptor (`{ package, specifiers[], origin, version }`) computed once in `publish.ts` (`resolveSharedLibs`); the default set is the React family (`react` + `react/jsx-runtime`, `react-dom` + `react-dom/client`), `origin: 'published'`.
- [x] 1.2 Derive the browser `external` list, the vendor entrypoints, and the importmap map all from the descriptor — deleted the three hardcoded React lists (`VENDOR_MODULES`, `browserExternal`, the importmap keys) so they cannot drift.
- [x] 1.3 `codegenVendorEntries` → generate one entry file **per specifier** (introspection form: `import * as ns` + `export const x = ns.x` for each installed export; identifier/reserved-word guarded; `export default ns.default` when present). Per-specifier entries mean no cross-specifier name collision to resolve.
- [x] 1.4 Replace the single combined vendor build with **one `Bun.build` over all per-specifier entries, `splitting: true`** (browser target, minified, content-hashed, `pinReact: true`). Output→specifier mapped by stripping the trailing `-<hash>.ext` (hash has no `-`, so unambiguous).
- [x] 1.5 `BuildDescriptor.assets` / `DocAssets`: replaced the single `vendor: string` with an importmap map `Record<specifier, url>` (no alias kept — the build is regenerated each publish).
- [x] 1.6 `documents.ts` `importMap()` emits the map (still in `<head>`, before the module script; empty when the map is empty). `renderDoc` / `shellDoc` / `primerDoc` and `prod-server.ts` thread the map instead of the single URL.
- [x] 1.7 Output is **equivalent**, not byte-identical: deliberately changed the vendor topology to per-specifier entries + a shared chunk (better cache granularity for fast-churning monorepo packages — D2). Invariants held: React delivered once site-wide, per-component bundles carry no React, importmap resolves. Verified by `publish.test.ts` + a real publish of this repo's showcase.

## Phase 2 — Author-declared shared libraries (D4, D5, D6)

- [x] 2.1 Added `share?: string[]` to `DisplayCaseConfig` (`src/index.ts`) with doc comment: packages to deliver once across the published surfaces (style-engine packages, shared libraries, monorepo workspace packages); bare specifier plus explicitly-listed subpaths; deep imports not listed stay inlined.
- [x] 2.2 Extended the descriptor from `share` (`resolveSharedLibs` + `packageInfo`): resolve each entry via `Bun.resolveSync(spec, pkgDir)` (worktree-safe); tag `origin: 'published' | 'workspace'` by whether the package's real path is under `node_modules` (realpath, to follow workspace symlinks); group declared specifiers by package.
- [x] 2.3 Vendor build covers the full descriptor — every declared specifier becomes a generated entry in the one `splitting` build; the importmap gains its mappings; every browser surface marks them `external`. The single-instance (pinReact-general) property follows from external + importmap.
- [x] 2.4 SSR split by `origin`: `published` → keep `external` on the SSR renderers; `workspace` → bundle into each SSR renderer (no external), since a private package has no deploy-time `bun install`.
- [x] 2.5 Generalized the generated showcase `package.json` dependencies (publish.ts) from hardcoded `react`/`react-dom` to **every `published` shared package** at the consumer's declared range (`readConsumerRanges`) or `^<installed version>`.
- [x] 2.6 Render-correct fallback: an undeclared deep import is simply not in `external`, so it stays inlined and renders — no failure path added (the default behavior already inlines).

## Phase 3 — Duplicate-runtime reporting (D5.3)

- [x] 3.1 From the per-component build's recorded module graphs (`runPublishBuild` now returns `inputs`), `reportInlinedDuplicates` computes which `node_modules` packages are inlined across more than one component bundle and the bytes duplicated (`packageOfInput` maps a path → package; already-shared packages are external and never appear, so excluded automatically).
- [x] 3.2 Emits a publish stdout report listing each candidate, its component count, and approximate duplicated (source) bytes, recommending `share` — without changing output or failing the build.
- [x] 3.3 Surface chosen: publish stdout summary (advisory only — never auto-shares).

## Verification (D8)

- [x] V.1 `documents.test.ts`: importmap is emitted from the descriptor map, precedes the module script, and is empty when the map is empty (multiple specifiers, each mapped to its own bundle URL).
- [x] V.2 `publish.test.ts` artifact contract: one vendor bundle per shared specifier; per-component bundles import each shared specifier as an external bare specifier (re-inlining guard); the importmap references the vendor bundles in the served shell, the `/render` doc, and the static export.
- [x] V.3 Phase 1 at scale: this repo's 35-component showcase publishes; React delivered once (vendor + shared chunk), per-component bundles carry no React, importmap resolves. (Topology changed from byte-identical — see 1.7.) Total assets ~1.3 MB, per-component ~8 KB.
- [x] V.4 Phase 2 test with a declared **non-React** (CJS-shaped) library `markdown-to-jsx` (`consumer-shared` fixture): one vendor bundle, per-component bundles import it externally, present in the importmap, added to the generated package.json; excluded from the duplicate report.
- [x] V.5 Headless browser load (`.tmp/verify-headless.ts`) of the published dogfood showcase shell + 4 render pages: all hydrate (`#root` populated) with **zero** console/page errors. **Caught a real bug**: Bun's prefix `external` leaked a shared library's internal subpath (`markdown-to-jsx/entities`) past the importmap → fixed with exact-match externalization (D6.1) + a `publish.test.ts` regression guard (the `consumer-shared` primer inlines the subpath).
- [x] V.6 Phase 3 (`consumer-dup` fixture, no `share`): the report names `markdown-to-jsx` with "in 2 components"; declaring it shared (`consumer-shared`) removes it from the report and externalizes it from the per-component bundles. Also confirmed at scale: the real repo flagged it in 6 components (~357 KB).
- [x] V.7 Full gate green: `bun run typecheck` · `bun run lint` (+ spec-purity) · `bun run check` · `bun test` (477) · `bun run e2e` (33).

## Documentation

- [x] D.1 `docs/configuration.md` — added the `share` field to the reference table and a full `### share` section (when to use it, subpath scope, single-version assumption, advisory report). Also dogfooded in `display-case.config.ts` (`share: ['markdown-to-jsx']`).
- [x] D.2 `contributing/NOTES.md` — new entry: the single-source-of-truth descriptor; why splitting is safe on the bounded vendor set but not the catalog; output→specifier mapping; the introspection form's whole-module / tree-shaking trade-off → conservative default; published-vs-workspace SSR split; exact-match externalization; sharing as the general form of pinReact.
- [x] D.3 `README.md` — added a publishing paragraph on per-component split + React-once + `share` + the duplicate report.
- [x] D.4 `openspec/config.yaml` — left as-is: the `publishing` capability-map line ("standalone, deployable showcase build") stays accurate at its altitude; the shared-runtime behavior lives in the spec, not the one-line map.
