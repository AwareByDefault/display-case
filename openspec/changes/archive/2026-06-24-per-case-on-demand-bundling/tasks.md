## 1. Per-case entries (D1)

- [x] 1.1 Add per-component codegen (`codegenCaseRenderEntry`/`codegenCaseSsrEntry`): one render entry and one SSR entry importing a single case file + config; dev server uses these. (The all-cases `codegenRenderEntry`/`codegenSsrEntry` are kept for the publish path until D5.)
- [x] 1.2 Change the render-mount path (`src/ui/render-mount.tsx`) to mount the one requested component; a cross-component `dc-render` navigates the frame to that component's address (loading its bundle) instead of an in-place swap. `sourcePath` tagging preserved.
- [x] 1.3 Confirm the manifest/catalog is still built from discovery independent of bundling (via the `--print-manifest` subprocess; the integration test asserts the catalog is served before any case is built). Codegen unit test asserts exactly one case per bundle.

## 2. On-demand dev build + cache (D2)

- [x] 2.1 Split `rebuild()` into: a fast startup that builds only the chrome (+ primer) and the manifest, and a per-component `buildCase(id)` that builds one component's render + SSR bundles.
- [x] 2.2 The per-component cache is keyed by component id and carries that component's recorded input graph; on a watch rebuild it is invalidated by graph membership (see 6.1) rather than wholesale. (Graph-aware invalidation is the substantive intent; an on-disk hash cache surviving process restarts was not needed — the in-memory cache + the persisted on-disk bundles cover it.)
- [x] 2.3 Wire the `/render` request routing to build-on-first-request via `ensureCase`, then serve; startup no longer builds any case.
- [x] 2.4 Preserve in-process SSR pre-render per component (fresh sequence-named import per build) so content is delivered before scripting.

## 3. Build isolation + graceful degradation (D4)

- [ ] 3.1 Run each per-case build in a subprocess so a *native* bundler crash is an attributed per-case failure rather than a dead server. (Implemented, then **reverted**: a cold `bun` spawn per build is pathologically slow on a contended CI runner — the a11y e2e timed out. Per-component bundling already keeps each graph small enough that a native crash does not arise — the report's individual heavy cases all built fine — so the build runs in-process. Build *errors* are still isolated and diagnosed; 3.2 covers that.)
- [x] 3.2 On a case build failure (caught in-process by `buildCaseBundles`), serve a chrome-free diagnostic for that case (component + source file + bundler logs) while every other case keeps serving; failures are cached so they aren't retried every request. Tested via `build-case.test.ts`.
- [x] 3.3 Publish builds each component separately and fails with a case-attributed error (`render/SSR bundle failed for component "<id>" (<file>)`) instead of a bare crash. (A one-shot build aborts on a bad component rather than serving a partial showcase — the "keep serving others" half applies only to the running server.)

## 4. Shared commons bundle + externalized vendors (D3) — ATTEMPTED, REVERTED

> Implemented end-to-end (vendor bundle of React stubs + `external` in per-case
> builds + an import map in the render document) and it worked in *unminified dev*
> at first glance — but a real-browser check exposed that the client React was
> broken and only **masked by the SSR markup**: a browser-only component (no SSR
> mask) rendered nothing, with `react does not provide an export named
> 'StrictMode'` (and `jsx`, `flushSync`). Root cause: Bun's `export * from 'react'`
> over a CJS module does not expose React's **named** exports across the
> import-map boundary to a separately-built bundle. Doing this correctly needs
> cjs-module-lexer-style enumeration of React's named exports (what Vite's
> `optimizeDeps` does) — out of scope here. Reverted in full; per-component
> bundles bundle React via `pinReact` (correct, ~larger). This is a pure
> optimization and the crash fix does not depend on it.

- [ ] 4.1 Build a single commons bundle once (React via `pinReact` + mount/render runtime + shared heavy deps); reuse `pinReact` resolution to keep exactly one React.
- [ ] 4.2 Determine the externalized set (React + deps shared across N+ cases or exceeding a module-count threshold, e.g. the icon barrel); start conservative and automatic, no required config.
- [ ] 4.3 Browser: emit an import map mapping externalized specifiers to the commons chunk URL; mark them external in per-case browser builds.
- [ ] 4.4 SSR (`target: 'bun'`): mark the same modules external and resolve them to the in-process commons module; add a single-React assertion test.

## 5. Bounded publish passes (D5)

- [x] 5.1 `publish()` builds the chrome (+ primer) once, then each component in its own `Bun.build` (browser + SSR) — no single all-cases pass. (Per-component, not per-IA-group; a shared commons chunk is D3, still deferred — each per-component bundle currently re-bundles React + the design system.)
- [x] 5.2 The descriptor's `assets.render` is a per-component map (componentId → hashed bundle URL); SSR is per-component `ssr-case-<id>.js`. `prod-server` dispatches the renderer by component id and references each component's own bundle. Build stays standalone and dev-free.
- [x] 5.3 Verified: published the real 35-component showcase — 35 render-case + 35 ssr-case bundles, no `render-entry`/`ssr-entry`, and `prod-server` serves each sampled component's own bundle, server-rendered. `publish.test.ts` updated for the per-component shape (artifacts + served build + static export).

## 6. Live-reload invalidation (D6)

- [x] 6.1 Each cached component carries its recorded `graphRecorder` input set; on a watch rebuild, only the components whose graph includes a changed path are invalidated (and every failed entry, to retry a fix) — not the whole cache. The changed paths are threaded from the watcher callbacks through the debounce. Tested by a live-reload integration test (`server.test.ts`).
- [x] 6.2 Editing a shared module (the config, `render-mount`, a workspace sibling) invalidates every component whose graph includes it (it is in their inputs), so all dependents rebuild on next visit; the current selection is preserved (existing live-reload behavior). The "rebuild the commons bundle" half is moot — D3 was reverted, so there is no commons bundle.

## 7. Verification

- [x] 7.1 Integration test (`src/server/server.test.ts`) boots the real large (35-component) showcase and asserts: it starts and serves the catalog before any case is built, a component builds on first request and serves its own bundle, and an unknown/failed case is isolated (server keeps serving). (A deliberately-unpreparable *build-failure* fixture asserting the diagnostic text is deferred — it needs a temp package with resolvable React for `pinReact`.)
- [x] 7.2 Ran the full gate green for this milestone: `bun run typecheck`, `bun run lint`, `bun run check`, `bun test` (416), `bun run e2e` (33).
- [x] 7.3 Recorded the per-component on-demand bundling architecture in `contributing/NOTES.md`. (coding-best-practices / docs updates fold in with the publish + commons milestones.)
- [x] 7.4 Added a changeset declaring the release impact.
