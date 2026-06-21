## 1. Configuration

- [x] 1.1 Add `startup?: 'off' | 'cached' | 'refresh'` to the `a11y` block of `DisplayCaseConfig` in `packages/display-case/src/index.ts`, defaulting to `off`, with a doc comment
- [x] 1.2 Thread the resolved `startup` mode through config resolution so the server can read it alongside `a11y.enabled` and `a11y.themes`

## 2. Scanner start-up entry point

- [x] 2.1 In `a11y-scanner.ts`, add a `populateAtStartup(variants, mode, onResult)` method to the object returned by `createA11yScanner` that short-circuits (no-op) when the scanner is unavailable
- [x] 2.2 In `cached` mode, for each variant compute its key, consult the existing `cachedViolations` reuse logic, and invoke `onResult` for every variant with a reusable result; run no scans
- [x] 2.3 In `refresh` mode, emit reusable results immediately and enqueue every uncached or stale variant onto the existing scan `queue`/`pump()` so it flows through the same `runJob` → `onResult` path; de-dup against the existing `inFlight` set
- [x] 2.4 Ensure start-up work is bounded by the existing concurrency cap and cannot starve on-demand requests

## 3. Server wiring

- [x] 3.1 In `server.ts`, derive the full variant list (manifest components × configured themes) once the scanner exists
- [x] 3.2 After the server is listening and the scanner is constructed, invoke `populateAtStartup(...)` detached (not awaited) when `a11y.startup` is `cached` or `refresh`, reusing the existing `onResult` → SSE `broadcast` wiring
- [x] 3.3 Have the server retain the latest known verdict per `{component, case, theme}` and expose it in the initial client payload (dedicated read-only endpoint or manifest sibling) so late-joining / reconnecting clients render already-known markers
- [x] 3.4 Leave `window.__displayCase` carrying only the `a11y` enabled flag (no verdicts inline)

## 4. Client navigation state

- [x] 4.1 In `use-shell.ts`, seed `byVariant` from the initial start-up payload on load via the existing `applyA11yResult` path
- [x] 4.2 Confirm SSE `a11y` events from start-up population fold into `byVariant` identically to on-demand results, and that the on-demand fetch-on-view flow is unchanged

## 5. Tests & verification

- [x] 5.1 Unit-test `populateAtStartup`: `cached` mode emits only reusable results and runs zero scans; `refresh` mode enqueues uncached + stale variants and reuses fresh ones; both no-op when unavailable
- [x] 5.2 Add coverage that the start-up payload seeds the navigation for a client that connects after the burst (late-join case)
- [x] 5.3 Manually verify each mode against a showcase with a mix of cached, stale, and never-scanned variants: `off` shows no markers at start, `cached` warms from cache with no scans, `refresh` fills uncached/stale verdicts as they land while the surface stays usable
- [x] 5.4 Confirm the `display-case` capability spec scenarios pass and run `bun run lint`

## 6. Docs

- [x] 6.1 Document the `a11y.startup` mode in `packages/display-case/README.md` (and the config reference / `.prompt.md` if applicable)
- [x] 6.2 Note the start-up population behavior in `docs/NOTES.md` if any non-obvious detail emerged during implementation
