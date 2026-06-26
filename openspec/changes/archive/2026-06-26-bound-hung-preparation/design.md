# Design

## D1. Why a timeout, not cancellation or detection

A hang has no signal and no output — there's nothing to observe that distinguishes
"still working on a huge graph" from "wedged forever." The only robust bound is
wall-clock time. We race the worker's completion against a `setTimeout`; whichever
wins decides the outcome. This mirrors the existing crash path (interpret the
worker's exit) by adding one more terminal condition (the clock).

## D2. Placement: in `spawnBuildWorker`, beside the slot it must free

The leak the hang causes is the **never-released `withBuildSlot` slot**. The fix
must live where the slot is held — inside the `withBuildSlot(...)` callback in
`spawnBuildWorker` — so that returning the contained failure runs the callback's
`finally`, decrements `buildActive`, and wakes the next waiter. Detecting the hang
anywhere else would report it but still leak the slot.

## D3. Kill, then ignore the late result

On timeout we `proc.kill()`. That eventually unblocks the in-flight
`Response(...).text()` / `proc.exited` collection — but we've already returned the
timeout failure, so that late result is irrelevant. We attach a `.catch(() => {})`
to the collection promise in `finally` so its post-kill settlement can never
surface as an unhandled rejection. We do **not** read partial stdout: a worker that
hung mid-build has no trustworthy `{ ok: true }` to honor.

## D4. The bound: generous default, read per call

`buildTimeoutMs()` reads `DISPLAY_CASE_BUILD_TIMEOUT` (ms) **per call**, not once at
module load, so a test can shorten it without import-cache games (the same pattern
as `buildWorkerPath()`). The default is 120s — deliberately generous: a single
component's bundle is normally well under a second, but a first-ever build of a
large graph on a cold, contended CI runner can take many seconds, and a false kill
mid-build would be worse than the hang it guards against. The bound exists to catch
*indefinite* stalls, not to enforce a latency budget.

## D5. Two call sites, two contracts

- `spawnBuildWorker` returns a `BuildOutcome`; a timeout is `{ ok: false, crashed:
  false, error: "…hung…" }`. `crashed: false` keeps the distinction the spec draws:
  a hang is not a bundler *crash*. The existing per-surface diagnostic path renders
  it like any other contained failure.
- `loadManifestFresh` *throws* on failure today (its caller `rebuild` either fails
  the startup bind loudly or logs the watch-rebuild error). A manifest timeout
  therefore throws too — same contract, now reached on a hang instead of only a
  non-zero exit.

## D6. Interaction with the crash path

The crash path keys off `proc.signalCode` (a signal death with no JSON). A
*timeout* fires before any exit, so the two never collide: if the worker crashes
first, `collect` wins the race and `classifyBuildResult` sees the signal; if it
hangs past the bound, the timeout wins. A worker we kill *on timeout* would itself
exit with a signal, but we've already returned by then and ignore that exit (D3),
so a killed-hang is reported as a hang, never reclassified as a crash.
