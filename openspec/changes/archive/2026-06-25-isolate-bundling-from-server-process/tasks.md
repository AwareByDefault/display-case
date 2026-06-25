## 1. Build worker + per-case build in a child (D1, D3, D4)

- [x] 1.1 Generalized `src/server/build-case.ts` into a build-worker CLI (`if (import.meta.main)`): build kind (`case` | `shell`) + params, runs the `Bun.build`(s), writes outputs to the `.display-case/` cache, emits `{ ok, inputs, error? }` JSON, exits.
- [x] 1.2 `buildCase` (server.ts) spawns the worker (`bun build-case.ts case …`) via `spawnBuild` instead of building in-process; reads the result, merges `inputs`, `import()`s the on-disk SSR bundle.
- [x] 1.3 Signal-death detection in `spawnBuild`: a worker that died on a signal (or yielded no `{ok:true}` JSON) is reported as a bundler crash, attributed to the surface; per-case it serves the chrome-free diagnostic.
- [x] 1.4 Bounded build concurrency: a semaphore (`withBuildSlot`, cap `clamp(cpus-1,1,4)`, env-overridable via `DISPLAY_CASE_BUILD_CONCURRENCY`) gates worker spawns; `ensureCase` in-flight dedup preserved.

## 2. Shell + primer builds in a child — no `Bun.build` in the server (D2)

- [x] 2.1 Added a `shell` kind (`buildShellBundles`) to the worker: builds `BROWSER_ENTRY` (+ optional primer browser + primer SSR) to the cache and reports `inputs`.
- [x] 2.2 `rebuild()` spawns the `shell` worker instead of the two in-process `Bun.build` calls; imports the on-disk primer SSR bundle. Verified `grep -nE "await Bun\.build|Bun\.build\(\{" src/server/server.ts` → zero calls.
- [x] 2.3 Shell-crash containment: a failed/crashed shell build sets `state.shellError`; the server still binds and serves `shellErrorHtml` (a 500 diagnostic) instead of the tool terminating.

## 3. Stage frame must not block page load (D5) — the CI-contention fix

- [x] 3.1 `use-shell.ts` assigns the stage `<iframe>` `src` only after the page `load` event (a `pageLoaded` gate), so a navigation completes on the chrome alone and a first-visit build never blocks `page.goto(..., waitUntil:'load')`.
- [x] 3.2 Verified the e2e suite under `--workers=2`: `a11y.spec.ts` (the prior CI timeout) + `navigation.spec.ts` pass; the full suite (33) passes. Locator discipline kept.

## 4. Startup tracing (D8)

- [x] 4.1 Startup tracing behind `DISPLAY_CASE_TRACE`: `trace()` logs wall-time + module counts around the shell-build child and the manifest child. Verified on the repo showcase: shell graph stays ~72 modules regardless of the 35-component catalog.

> Deferred to follow-up changes (kept out so this change stays focused on the
> reported `--dev` crash): **publish crash-containment** (route publish's per-
> component builds through the worker — publish already builds small per-component
> graphs and is short-lived) and the **preventative budget / barrel-import checks**
> (once bundling is crash-contained, a too-large case fails gracefully).

## 5. Tests & verification

- [x] 5.1 Worker unit tests (`build-case.test.ts`): `case` kind builds to disk + reports inputs; a build error → `{ok:false}`; the spawned worker exits 0/non-zero/2 by kind.
- [x] 5.2 Server integration test (`server.test.ts`) boots the real 35-component showcase (shell built in the worker) and serves on demand; an unknown component does not crash the server.
- [x] 5.3 Confirmed no `Bun.build` in `src/server/server.ts`; full gate (`typecheck`, `lint`, `check`, `bun test`, `bun run e2e`).
- [x] 5.4 Updated `contributing/NOTES.md` (all-bundling-in-children + the iframe-load decoupling) and added a `patch` changeset.
