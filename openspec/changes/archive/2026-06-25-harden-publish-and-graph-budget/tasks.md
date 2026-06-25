## 1. Shared build runner (D1)

- [x] 1.1 Create `src/server/build-runner.ts`: move `BuildOutcome`, `classifyBuildResult`, `withBuildSlot` + the `DISPLAY_CASE_BUILD_CONCURRENCY` cap, and `spawnBuildWorker` (today's `spawnBuild`, with the `DISPLAY_CASE_BUILD_WORKER` hook + stderr passthrough) out of `server.ts`.
- [x] 1.2 Extend `BuildOutcome` with optional `outputs?: BuildOutput[]`; `classifyBuildResult` passes `parsed.outputs` through (dev kinds leave it undefined).
- [x] 1.3 `server.ts` imports from `build-runner.ts` and re-exports `classifyBuildResult` (and any symbol `server.test.ts` imports from `./server`) so existing tests/imports are unchanged. Verify `grep -nE 'await Bun\.build|Bun\.build\(\{' src/server/server.ts` stays at zero.

## 2. Publish build kind in the worker (D2)

- [x] 2.1 Add a `publish` kind to `build-case.ts`'s `import.meta.main` dispatch: `bun build-case.ts publish <descriptorJson>`; parse the `PublishBuildRequest`, reconstruct plugins (`graphRecorder` + `mdxPlugin` + optional `pinReact(pkgDir)`), run one `Bun.build`, emit `{ ok, inputs, outputs, error? }` with entry-point output paths in `outputs`.
- [x] 2.2 Arity/shape guard for the `publish` kind (bad/missing descriptor → exit 2 via `badArgs`), consistent with the existing kinds.

## 3. Crash-contained publish orchestration (D3)

- [x] 3.1 In `publish.ts`, replace the chrome-shell `Bun.build` with a `spawnBuildWorker(['publish', JSON.stringify(req)])` call; map returned entry-point `outputs` to `assets.browser`/`assets.primer` via the existing `entryName`.
- [x] 3.2 Replace the per-component browser-render loop with child builds run through `withBuildSlot` (bounded pool, concurrent); map each entry-point output to `assets.render[id]`.
- [x] 3.3 Replace the primer-SSR and per-component-SSR `Bun.build` calls with child builds (target `bun`, `external` React, `pinReact:false`, fixed SSR naming); run the per-component SSR builds through the pool.
- [x] 3.4 Crash/attribution: a `crashed` child throws `Display Case publish: bundling <surface> crashed the bundler (killed by <signal> …)`; a logical `!ok` throws the existing per-surface error. Publish exits non-zero; no partial artifact is presented as complete.
- [x] 3.5 Verify `grep -nE 'await Bun\.build|Bun\.build\(\{' src/commands/publish.ts` → zero calls.

## 4. Bundle-graph budget check (D4, D6)

- [x] 4.1 New `src/checks/graph-check.ts`: pure `analyzeComponentGraph(inputs, { modules, perPackage })` → `{ total, overBudget, packages[], barrels[] }` (group by owning `node_modules` package incl. `@scope/name`; barrels = packages over `perPackage`).
- [x] 4.2 Phase orchestration: for each component, build it through the crash-contained build worker, read `inputs`, run `analyzeComponentGraph`; a `crashed` build is a hard failure with the attributed diagnostic.
- [x] 4.3 Reporting via `check-reporter`: per-component module-total line, a warning per over-budget component and per barrel package (name + count + "import only what you use" hint), phase summary; `--strict` escalates warnings to errors.

## 5. CLI + config wiring (D5)

- [x] 5.1 `src/index.ts`: add optional `check.graphBudget?: { modules?: number; perPackage?: number }` to the config type; `*.test-d.ts` assertion for the new optional shape.
- [x] 5.2 `src/cli.ts`: add the `--graph` phase flag; include the graph phase in a no-flag `display-case check` (all-phases) but NOT in the slim `--structure --tokens --ssr` set; thread `config.check?.graphBudget` (with defaults `modules:1500`, `perPackage:400`) into the phase.
- [x] 5.3 `src/checks/check.ts`: register/run the graph phase in `CheckOptions`/`runChecks`.

## 6. Tests

- [x] 6.1 `build-case.test.ts`: `publish` kind builds to a temp out-dir, returns `{ ok:true, outputs:[…] }` with content-hashed entry names; bad descriptor exits 2.
- [x] 6.2 `build-runner` (or `server`) test: `classifyBuildResult` passes `outputs` through on success; signal-death still classifies as `crashed`.
- [x] 6.3 `publish.test.ts`: a normal showcase still publishes (assets present, manifest/descriptor written, static export still works) — proving the child-build path is equivalent; and a crash-injected worker (`DISPLAY_CASE_BUILD_WORKER` stub that dies on a signal) makes `publish` reject with an attributed "crashed the bundler" message rather than the process dying.
- [x] 6.4 `graph-check.test.ts`: `analyzeComponentGraph` — under budget (no warnings), over total budget (`overBudget`), a barrel package over `perPackage` is flagged with its count, `@scope/name` grouping, files outside `node_modules` ignored, empty inputs safe.
- [x] 6.5 Graph-phase integration: `display-case check --graph` on a small fixture reports module totals and exits 0; under `--strict` an over-budget fixture fails. Deterministic (no clock/random).

## 7. Verification & docs

- [x] 7.1 `bun run lint`, `bun run typecheck`, `bun run check`, `bun test` all green; `bun run e2e` unaffected (no chrome change).
- [x] 7.2 Manually publish the repo's own showcase (regular + `--static`) and confirm equivalent output to pre-change (assets, SSR, static HTML).
- [x] 7.3 Docs: `docs/cli.md` (the `--graph` phase), `docs/configuration.md` (`check.graphBudget`), `docs/publishing.md` if present (publish is crash-contained); `contributing/NOTES.md` (publish now routes through the build worker; the graph phase reads the real recorded graph).
- [x] 7.4 Add a changeset (minor: new `--graph` check phase + `check.graphBudget` config; publish hardening).
