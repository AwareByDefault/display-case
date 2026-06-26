## Why

The `scalable-serving` capability already contains a failure to prepare any single
surface — to that surface — when the failure is a **logical build error** (the
graph can't be bundled) or an **abnormal termination** of the bundler (a crash).
But it enumerates exactly those two modes, and the implementation only handles
those two: a build worker's exit is interpreted as success, logical error, or
signal-death crash.

There is a third mode the spec doesn't cover and the tool doesn't handle: a
preparation that **neither completes nor crashes** — it *hangs*. A case module with
a never-resolving top-level `await`, a bundler plugin that spins, a deadlocked
import. The worker's `exited` never resolves, so its bounded concurrency slot is
never released; once enough slots are stuck, **every** subsequent preparation
queues behind a dead slot forever. The server stays "up" (serves `/health` and
already-built surfaces) but silently never prepares another surface again. At
startup the manifest subprocess hanging means the server never even binds.

This is the same class of harm the crash-containment guarantee exists to prevent —
one surface's preparation taking down the tool's ability to serve the others —
just reached through a hang instead of a crash. It should be contained the same
way: bounded, abandoned, attributed, and survived.

## What Changes

- **A hung preparation is bounded and contained.** Each surface's preparation (and
  the manifest subprocess) is given an upper time bound. A preparation that neither
  completes nor crashes within the bound is abandoned — its worker terminated — and
  reported as a contained per-surface failure (distinct from a bundler *crash*),
  with the tool process and every other surface unaffected. The bound is generous
  by default (so a legitimately large bundle on a cold, contended runner is not
  killed mid-build) and overridable.
- **The held resource is released.** Killing the hung worker frees its bounded
  preparation slot, so a single hang can no longer permanently wedge all further
  preparation.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `scalable-serving`: the **Isolated, diagnosed preparation failure** requirement
  is broadened from two failure modes (a logical build error; an abnormal bundler
  termination) to **three** — adding a preparation that **neither completes nor
  crashes within a bounded time (a hang)**. Such a preparation MUST be abandoned at
  the bound (its worker terminated, its preparation slot released) and reported as
  a contained per-surface failure, leaving the tool running and every other surface
  served.

## Impact

- **Affected code:** `src/server/build-runner.ts` (`spawnBuildWorker` races the
  worker against a bounded timeout; on expiry it kills the worker and returns a
  contained, non-crash failure; `buildTimeoutMs()` reads the bound from
  `DISPLAY_CASE_BUILD_TIMEOUT`, default 120s), `src/server/server.ts`
  (`loadManifestFresh` gets the same bound — on expiry it kills and throws, so a
  hung manifest subprocess becomes a contained, logged failure instead of a stall).
- **No public API or authoring change.** Addresses, the manifest, case authoring,
  and the published-build contract are unchanged.
- **Performance:** none on the success path (a single `setTimeout` per build,
  cleared on completion). The trade-off is that a build exceeding the (generous,
  overridable) bound is killed — surfaced as a diagnostic rather than a silent
  stall.
