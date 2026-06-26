## 1. Shared vendor bundle (D1, D2, D4)

- [x] 1.1 `codegenVendorEntry` generates the vendor entry by introspecting the consumer's installed `react`/`react-dom`/`react-dom/client`/`react/jsx-runtime` exports (`Bun.resolveSync` + `import`), emitting `import * as ns` + `export const x = ns.x` per name (static bindings, full impl retained), first-module-wins on collisions, plus `export default`.
- [x] 1.2 `publish.ts` builds the vendor entry once (`target: browser`, minified, content-hashed, `pinReact: true`), and records `assets.vendor`.

## 2. Externalize the runtime from the browser surfaces (D3, D4)

- [x] 2.1 The chrome build and each per-component render build set `external: ['react','react-dom','react-dom/client','react/jsx-runtime']` and `pinReact: false` (the worker already plumbs `external`).
- [x] 2.2 `BuildDescriptor.assets` + `DocAssets` carry `vendor`.

## 3. Importmap in every document (D1)

- [x] 3.1 `documents.ts` emits `<script type="importmap">` (in `<head>`, before the module script) mapping the four bare specifiers to `assets.vendor`; empty when no vendor URL.
- [x] 3.2 `renderDoc` takes a `vendor` param; `prod-server.ts` passes `assets.vendor` to it. `shellDoc`/`primerDoc` read it from `assets`.

## 4. Verification (D5)

- [x] 4.1 `documents.test.ts`: importmap present, maps the specifiers, precedes the module script, omitted when `vendor` is empty.
- [x] 4.2 Real publish of this repo's showcase: per-component bundle ~191 KB → ~6 KB; total assets ~7.2 MB → ~1.2 MB; vendor ~190 KB carries the reconciler; no React fingerprint inside per-component bundles.
- [x] 4.3 Headless browser load of the published shell + several render pages: each hydrates with zero console/page errors (React resolves via the importmap). Static export contains the importmap.
- [x] 4.4 `bun run typecheck`, `bun run lint`, `bun test`, `bun run e2e` pass.
- [x] 4.5 `publish.test.ts` (the publish harness) asserts the artifact contract automatically — exactly one content-hashed `vendor-react-*.js` carrying the runtime, a per-component bundle importing React as an external bare specifier (re-inlining guard), and the importmap referencing the vendor bundle in the served shell, the `/render` doc, and the static export — so a dropped importmap or re-inlined React is caught in CI, not only by the manual checks in 4.2/4.3.
