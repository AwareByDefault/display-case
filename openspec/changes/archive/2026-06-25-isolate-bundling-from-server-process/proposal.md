## Why

The per-case on-demand bundling shipped in 1.3.0 moved *case* bundling off the
startup path and isolated the *manifest* load into a fresh subprocess, but a
follow-up report proves **`--dev` on a large showcase still segfaults at startup,
in the long-lived main process**, with a Bun heap-corruption signature
(`panic: Segmentation fault at address 0xAAAAAAAAAAAAAAAE`, poison address,
variable timing, deterministic by catalog size).

The decisive evidence: `display-case <pkg> --print-manifest` — which `await
import()`s the **entire** catalog's module graph — exits cleanly **every** time in
its short-lived child, while the **same** catalog kills the main `--dev` process.
So loading the graph is not the problem; the differentiator is that the main
process is the one that **runs Bun's bundler** (the shell `Bun.build` plus its
`graphRecorder`/`mdxPlugin`/`pinReact` plugins, alongside spawning children and
resolving tsconfig paths). Bundler heap state accumulating in a long-lived process
is the precondition for the crash. 1.3.0 left the **shell** and **primer** builds
— and (after a CI-driven revert) the **per-case** build — running in that process.

The robust remedy, generalizing what `loadManifestFresh` already does: **never run
`Bun.build` in the long-lived server process.** Every bundle is produced in a
fresh, short-lived child whose heap dies with it; the server only orchestrates and
serves bytes. This removes the precondition regardless of which exact Bun bug is
tripped, and lets a bundler crash be *attributed and contained* instead of
inherited as a bare native panic.

A previous attempt to run per-case builds in a subprocess was reverted because the
per-build `bun` spawn timed out CI's a11y e2e on a contended runner. This change
must therefore *also* fix that contention so the isolation is sustainable.

## What Changes

- **No `Bun.build` in the long-lived dev server.** The shell build, the primer
  build(s), and each per-case build all run in a spawned child that exits when the
  build completes; the server reads the on-disk bundles and the child's reported
  module graph, and `import()`s only the (already-built) SSR bundles (evaluation,
  which is proven safe — `--print-manifest` does it).
- **A bundler crash is contained and attributed.** A build child that dies on a
  signal (a native Bun segfault) — not only one that returns a logical build error
  — is reported as "bundling `<surface>` crashed the bundler" and the server keeps
  running and serving every other surface. The startup shell build that crashes no
  longer takes the whole tool down.
- **Bounded build concurrency.** Concurrent build children are capped so the
  isolation cannot oversubscribe a constrained machine (the regression that
  reverted the earlier subprocess attempt).
- **The preview frame no longer blocks page load on a first-visit build.** A
  navigation to a browse route completes without waiting for the stage's
  on-demand build, so first-visit build latency (and any build contention) cannot
  stall navigation — the specific failure mode that timed out CI's a11y e2e.
- **Startup invariant logging.** Optional timing/size logging around the shell
  build, config import, and manifest load makes the "size-independent startup"
  invariant verifiable on a large consumer.

Two adjacent robustness items are worthwhile *follow-ups*, out of scope here so
this change stays focused on the reported `--dev` crash:
- **Publish crash-containment** — `publish` already builds each component in its
  own bounded `Bun.build` (size-independent), but in one process; routing those
  builds through the worker too (a child per component) would contain a publish-
  time bundler crash. Publish builds small per-component graphs and is short-lived
  (its heap dies at exit), so the risk is low.
- **A preventative `check` layer** — flagging a case whose transitive graph is
  unusually large, and warning on massive barrel imports — turns a latent risk
  into a lint. Once bundling is isolated and crash-contained, a too-large case
  fails gracefully with a diagnostic instead of crashing the tool, so it is no
  longer load-bearing.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `scalable-serving`: the showcase's preparation MUST NOT be able to terminate the
  tool process — starting/serving a showcase of any size keeps the tool running
  even when bundling some surface crashes the underlying bundler; and the
  isolated/diagnosed-failure guarantee is broadened from a single case's *logical*
  build error to **any surface** (chrome, primer, or case) whose bundling fails
  **or crashes the bundler (abnormal termination)**.

## Impact

- **Affected code:** `src/server/build-case.ts` (generalize into the build worker
  invoked as a child for every build kind), `src/server/server.ts` (`rebuild` and
  `buildCase` orchestrate child builds instead of calling `Bun.build`; signal-death
  detection; concurrency cap), `src/ui/use-shell.ts` / `src/ui/render-mount.tsx`
  (the stage frame must not block page load), `src/commands/publish.ts` (crash-
  contained per-component builds), `src/checks/` (the new budget/barrel phase),
  and the e2e suite where the stage-load timing changes.
- **No public API or authoring change.** Addresses, the manifest, case authoring,
  and the published-build contract are unchanged.
- **Performance:** startup spawns one extra short-lived child (the shell build);
  first-visit per-case builds run in a bounded pool of children; the trade-off is
  bundler-crash immunity for the long-lived process.
- **Upstream:** the underlying Bun heap bug should still be filed; this change
  removes Display Case's dependence on a Bun fix.
