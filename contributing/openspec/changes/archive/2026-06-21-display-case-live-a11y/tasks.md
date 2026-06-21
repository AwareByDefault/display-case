## 1. Config + violation model

- [x] 1.1 Add optional `a11y` block to `DisplayCaseConfig` (`src/index.ts`): `{ enabled?: boolean (default false); themes?: ('light'|'dark')[]; exclude?: string[] }`; document defaults
- [x] 1.2 Extend `A11yViolation` to `{ id, help, nodes, impact }`; map axe's `impact` through `providers/playwright-driver.ts`
- [x] 1.3 Update `check.ts` to read shared scan params (`themes`, `exclude`) from `config.a11y`, run independently of `enabled`, and include `impact` in its report

## 2. Async scanner + cache

- [x] 2.1 Add a scanner module: one lazily-launched, reused browser + a serial job queue; lazily import the driver and catch missing-browser into an `unavailable` signal
- [x] 2.2 Implement the per-variant transitive-input hash: crawl a `.case.tsx`'s resolved component imports, fold in shared inputs (global styles, tokens, render chrome, decorator)
- [x] 2.3 Implement the `.display-case/a11y/` cache (one JSON per component/case/theme) with layered validity: stat (mtime+size) → content-hash on change
- [x] 2.4 Wire on-demand scan-or-serve-cache for a requested (component, case, theme); debounce + prioritize the viewed variant
- [x] 2.5 Decide + implement cache invalidation across Display Case's own version (tool version in hash or clear-on-bump) — resolves an Open Question

## 3. Server wiring

- [x] 3.1 Add a server route/handler for "result for (component, case, theme)" returning cached | pending and enqueuing a scan
- [x] 3.2 Register the live-update SSE channel in normal mode (not just `--dev`); push a11y results and rebuild signals over it
- [x] 3.3 Broaden the non-dev watcher to component sources (`*.ts/tsx/css`); make watch + live-reload the default for `display-case .`
- [x] 3.4 On rebuild, invalidate the affected variant's cached a11y entry and enqueue a rescan

## 4. Browse-surface wiring (replace mock with live)

- [x] 4.1 Populate the `a11y` view-model field in `useShell()` from the server: request on selection/theme change, set `pending`, update on push; leave `a11y` undefined when not configured
- [x] 4.2 Switch live reload from full `location.reload()` to stage-iframe-only reload (reassign `frameRef.current.src` / version query), preserving selection via the existing handshake
- [x] 4.3 Order panel violations by impact then node count; reflect the shown theme; keep nav markers (sum collapsed / per-variant expanded / leaf count) fed by live `byVariant`
- [x] 4.4 Surface the `unavailable` state in the panel when the scan prerequisite is missing
- [x] 4.5 Re-scan affordance: panel ⟳ button → forced re-scan (server `?rescan=1`, scanner drops cache); useShell.rescanA11y; interactive page-case variant

## 5. Verification + docs

- [x] 5.1 e2e: dummy consumer fixtures (a11y-on with a violation + a11y-off control) as extra webServers; a11y.spec.ts covers violation panel+marker, clean pass, re-scan pending→resolved, per-theme, and unconfigured-shows-neither
- [x] 5.2 Run `check --a11y` over Display Case; confirm the panel and the CLI agree on counts for the same theme/params
- [x] 5.3 Confirm graceful degradation: enable a11y with the browser uninstalled → server boots, browses, shows `unavailable`
- [x] 5.4 Update `packages/display-case/README.md` + `display-case.prompt.md` + `docs/ai-agents.md` for the `a11y` config, the in-app surface, and the default-watch / future-`build` run-mode split
- [x] 5.5 Note in `docs/NOTES.md`: scanner architecture, cache key/location, and the `enabled` vs CLI-gate independence
