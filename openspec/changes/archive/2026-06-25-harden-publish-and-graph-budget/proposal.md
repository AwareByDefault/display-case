## Why

The `isolate-bundling-from-server-process` change (1.4.0) moved **every** dev-server
`Bun.build` into a fresh, short-lived child whose heap dies with it — removing the
precondition for the Bun bundler heap-corruption segfault on a large showcase, and
letting a bundler crash be *attributed and contained* instead of inherited as a
bare native panic. It deliberately left two robustness items as follow-ups:

1. **`publish` still runs every `Bun.build` in one long-lived process.** A publish
   of a large showcase runs `2N+2` bundles back-to-back in the publish process
   (the chrome shell, one browser bundle per component, one SSR bundle per
   component, and the primer SSR). That is exactly the *bundler-heap-in-a-
   long-lived-process* accumulation the segfault report identified — so a large
   showcase that the dev server now serves safely can still kill `publish` with the
   same native panic, mid-build, taking down the only path that produces a
   deployable artifact. The dev server is hardened; the publish path is not.

2. **Nothing warns an author before a graph grows large enough to destabilize
   bundling.** With isolation in place a pathological component now fails *gracefully*
   (a contained diagnostic) rather than crashing the tool — but the author still
   only finds out at build time, per surface, with no signal about *which* import is
   responsible. The report's recommended preventative lint (flag an unusually large
   transitive graph; warn on massive barrel imports such as a whole icon set) was
   never built.

This change closes both gaps, completing the hardening the two segfault reports
called for.

## What Changes

- **No `Bun.build` in the long-lived `publish` process.** Every publish bundle —
  the chrome shell, each per-component browser bundle, each per-component SSR
  bundle, and the primer SSR — is produced in a fresh, short-lived child (the same
  build-worker mechanism the dev server uses), through a bounded concurrency pool.
  The publish process only orchestrates the children and reads back the bundle
  bytes and content-hashed output names. This holds for **all three** build forms a
  publish produces: the browser bundles a **regular** (server-hosted) build serves,
  the same bundles a **static** (server-less) export embeds, and the **SSR**
  renderers the production server imports.
- **A publish-time bundler crash is contained and attributed.** A build child that
  dies on a **signal** (a native Bun segfault) — not only one returning a logical
  build error — makes `publish` fail with a precise, actionable diagnostic naming
  the surface that crashed the bundler (`publishing component "<id>" crashed the
  bundler …`) and exit non-zero, instead of the publish process terminating with a
  bare native panic. No partial/corrupt artifact is left behind.
- **A new preventative `check` phase: bundle-graph budget.** `display-case check`
  gains a graph phase that, for each component, reports its real bundled
  module-graph size and **warns** when (a) the component's total module count
  exceeds a configured budget, or (b) a single dependency package contributes a
  disproportionate share of that graph (the barrel-import signal — e.g. importing a
  whole icon set instead of the few icons used). It also surfaces a component whose
  isolated build *crashes* the bundler as a hard failure with the same diagnostic.
  Warnings are advisory by default and become errors under `--strict`, matching the
  existing structure-check posture. Thresholds are configurable.

## Non-Goals

- **Vendor/commons chunk extraction** (sharing one React copy across per-component
  bundles, externalizing heavy barrels) — a bundle-*size* optimization, not
  hardening, and previously attempted and reverted because Bun's `export *` cannot
  re-expose React's CommonJS named exports across the `pinReact` import map. It is
  not required for crash-safety and stays out of scope.
- **Changing the published-build contract.** Addresses, the manifest, the asset
  layout, the static export, and `prod-server`'s inputs are unchanged; only *how*
  the bundles are produced changes.

## Capabilities

### New Capabilities
- `bundle-graph-budget`: `display-case check` reports each component's bundled
  module-graph size and warns when a component exceeds a configured graph budget or
  when one dependency dominates its graph (a barrel import), with thresholds
  configurable and warnings escalating to errors under strict mode.

### Modified Capabilities
- `scalable-serving`: the non-termination + isolated-failure guarantee is extended
  from the running server to **publishing** — producing a deployable build of a
  showcase of any size MUST run each surface's bundling in an isolated child so the
  publish process never accumulates bundler heap state, and a surface whose
  bundling **crashes the bundler (abnormal termination)** MUST be contained and
  attributed (a clear per-surface diagnostic + non-zero exit), never inherited as a
  native panic.

## Impact

- **Affected code:** `src/server/build-case.ts` (extend the build worker with a
  publish build kind that emits content-hashed outputs and reports them), a shared
  spawn/classify runner reused by both the server and publish (extracted from
  `src/server/server.ts`), `src/commands/publish.ts` (each `Bun.build` becomes a
  crash-contained child build through a bounded pool), `src/checks/` (the new
  graph-budget phase + reporter wiring), `src/cli.ts` (the `--graph` phase flag and
  config plumbing), `src/index.ts` (the optional `check.graphBudget` config shape),
  the colocated unit tests, and `docs/`.
- **No public authoring API change.** `defineConfig` gains an *optional* nested
  `check.graphBudget` field; existing configs are unaffected.
- **Performance:** publish spawns one short-lived child per bundle through a bounded
  pool — comparable wall-clock to today's serial in-process builds (often faster
  via concurrency), trading a small spawn overhead for publish-time bundler-crash
  immunity. The graph phase is opt-in to the default `check` run and reuses the
  build worker's recorded module graph, so it adds no bundling beyond what a build
  already does.
- **Upstream:** the underlying Bun heap bug has been filed; this change removes
  Display Case's remaining dependence on a Bun fix (the publish path).
