## 1. Bound the build worker (D1–D4, D6)

- [x] 1.1 Added `buildTimeoutMs()` to `build-runner.ts` — reads `DISPLAY_CASE_BUILD_TIMEOUT` (ms) per call, default 120000.
- [x] 1.2 `spawnBuildWorker` races the stdout/stderr/exit collection against a `setTimeout`; on timeout it `proc.kill()`s and returns `{ ok: false, crashed: false, error: "…hung (no result within Nms; killed)" }`. The race lives inside `withBuildSlot`, so the contained failure releases the slot via the callback's `finally`.
- [x] 1.3 The timer is cleared in `finally`; the post-kill collection is `.catch(() => {})`-guarded so its late settlement never becomes an unhandled rejection.

## 2. Bound the manifest subprocess (D5)

- [x] 2.1 `loadManifestFresh` (server.ts) races the same way; on timeout it kills the `--print-manifest` child and throws `manifest build subprocess hung (…)`, matching its existing throw-on-failure contract (startup bind fails loudly / watch rebuild logs it).

## 3. Verification

- [x] 3.1 Added `build-worker hang containment` test: a stub worker that never resolves, with `DISPLAY_CASE_BUILD_TIMEOUT=400`, is killed and returns `{ ok: false, crashed: false, error: ~/hung/ }` within 5s (not stalled).
- [x] 3.2 `bun run typecheck`, `bun run lint`, `bun test`, `bun run check`, `bun run e2e` all pass.
- [x] 3.3 Existing crash-containment test (signal death → `crashed: true`) still passes, confirming hang and crash stay distinct.
