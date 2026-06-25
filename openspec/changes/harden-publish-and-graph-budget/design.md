## Context

`isolate-bundling-from-server-process` (1.4.0) established the architecture: the
long-lived dev server NEVER calls `Bun.build`; every bundle is produced in a fresh,
short-lived child (`src/server/build-case.ts`, the build worker) spawned by
`spawnBuild` in `src/server/server.ts`, whose exit is interpreted by the pure
`classifyBuildResult` (a signal-death = a native bundler crash, contained and
attributed). Concurrency is bounded by `withBuildSlot`.

`src/commands/publish.ts` was left on the old model: it runs **four** kinds of
`Bun.build` in-process — the chrome shell (`:191`), one browser render bundle per
component in a loop (`:219`), the primer SSR bundle (`:263`), and one SSR bundle
per component in a loop (`:279`) — i.e. `2N+2` bundler runs accumulating heap in a
single long-lived process, the exact precondition the segfault reports identified.
Publish therefore still inherits a native panic on a large showcase, on the only
path that produces a deployable artifact.

Separately, no `check` phase predicts the risk: an author learns a graph is too big
only when a surface fails to build.

Constraints carried over: render purity, worktree safety (all paths anchor to the
target package; the `.display-case/` cache is per-package), dependency-light (no
new runtime deps), and the single-React (`pinReact`) guarantee for the browser and
chrome bundles. The published SSR bundles keep React **external** (a clean deploy
has one installed React), as today — the isolation must not change *what* is built,
only *where* it runs.

## Goals / Non-Goals

**Goals:**
- `publish` NEVER calls `Bun.build` in its own process. Every publish bundle is
  built in a fresh child whose heap dies with it — removing the accumulation
  precondition for all three build forms (regular/static browser bundles + SSR).
- A publish build child that dies on a **signal** is contained and attributed:
  `publish` fails with a precise per-surface diagnostic and a non-zero exit, leaving
  no partial artifact — never a bare native panic.
- A new `check` phase warns, before build time, when a component's real bundled
  module graph exceeds a budget or one dependency dominates it (a barrel import),
  and hard-fails a component whose isolated build crashes the bundler.
- The server's existing crash-isolation code is *reused*, not duplicated.

**Non-Goals:**
- Vendor/commons chunk extraction (a size optimization, reverted before; see
  proposal Non-Goals).
- Any change to addresses, the manifest, the asset layout, the static export shape,
  or `prod-server`'s inputs.

## Decisions

### D1 — Extract a shared build runner (`src/server/build-runner.ts`)

Move the parent-side spawn/classify/concurrency primitives out of `server.ts` into
a small module both the server and publish import:
- `BuildOutcome` (extended with an optional `outputs?: BuildOutput[]` — see D2),
- `classifyBuildResult(stdout, code, signal)` (unchanged semantics; now also passes
  `parsed.outputs` through),
- `withBuildSlot` + the `DISPLAY_CASE_BUILD_CONCURRENCY` cap,
- `spawnBuildWorker(args)` (today's `spawnBuild`, including the
  `DISPLAY_CASE_BUILD_WORKER` test hook and stderr passthrough).

`server.ts` re-exports `classifyBuildResult`/`shellErrorHtml`-adjacent symbols it
already exports so `server.test.ts` keeps importing them from `./server`
unchanged. Pure-function semantics and existing tests are preserved; this is a
mechanical extraction that removes duplication before publish reuses it.

### D2 — A generic `publish` build kind in the worker

Extend the worker's `import.meta.main` dispatch with one new kind invoked as
`bun build-case.ts publish <descriptorJson>`, where `<descriptorJson>` is a single
JSON argv carrying a *serializable* subset of `Bun.build` options the parent
computed:

```ts
interface PublishBuildRequest {
  pkgDir: string            // for plugin construction (graphRecorder/mdx/pinReact)
  entrypoints: string[]     // absolute entry files the parent codegen'd to disk
  outdir: string            // absolute
  target: 'browser' | 'bun'
  minify: boolean
  sourcemap: 'none'
  naming: { entry: string; chunk: string; asset?: string }
  define: Record<string, string>   // parent-computed (BUN_PUBLIC_* + NODE_ENV); safe to inline
  external?: string[]              // SSR builds keep React external
  pinReact: boolean                // chrome/render: true; SSR: false
}
```

The worker reconstructs the plugin list (`graphRecorder` + `mdxPlugin` + optionally
`pinReact(pkgDir)`), runs one `Bun.build`, and emits
`{ ok, inputs, outputs, error? }` where `outputs` is the list of entry-point output
paths (so the parent can map content-hashed basenames to asset URLs). Codegen of
entry files stays in the parent (`publish.ts`) — only the `Bun.build` call moves to
the child. A logical failure is `{ ok:false, error }` (exit 1); a native crash kills
the child (signal exit, no JSON) and is classified as `crashed`.

*Rationale for passing options as a descriptor rather than positional args:* publish
builds vary on many axes (target, minify, external, naming, define) that don't fit
the dev kinds' fixed positional shape; one JSON descriptor keeps the worker generic
without a combinatorial argv. Plugins (non-serializable) are reconstructed
worker-side from `pkgDir` + `pinReact`.

### D3 — `publish.ts` orchestrates child builds through the pool

Each in-process `Bun.build` in `publish.ts` becomes a `spawnBuildWorker(['publish',
JSON.stringify(req)])` call. The per-component browser and SSR builds run through
`withBuildSlot` concurrently (a bounded pool) instead of serially — publish gets
*faster*, not slower, despite per-build spawn overhead. On each result:
- `ok` → map `outputs` entry-points to `${base}/assets/<basename>` (browser/chrome)
  exactly as today; SSR outputs use the deterministic fixed name and need no
  mapping.
- `crashed` → `throw new Error('Display Case publish: bundling <surface> crashed
  the bundler (killed by <signal>; likely the large-graph heap bug in Bun) …')`.
- logical `!ok` → `throw` the same per-surface error as today, with the child's
  logs (already written to stderr by the runner).

Because the publish process catches the child's failure, a crash yields a clean
non-zero exit with an attributed message; the already-`rm`'d/partial `out/` is not
presented as a finished build (publish already throws on any bundle failure, so the
caller treats it as failed — no extra cleanup contract change).

This holds for all three forms uniformly: the **regular** server and the
**static** export both consume the per-component *browser* bundles, and the
production server imports the per-component *SSR* bundles — all now child-built.
`writeStaticExport` itself only *renders* (no `Bun.build`), so it inherits the
containment for free.

### D4 — The graph-budget phase reads the *real* module graph (crash-safe)

Rather than re-implement a resolver (which would diverge from the bundler's actual
graph), the phase builds each component through the **same crash-contained build
worker** and reads the `inputs` it already records (the bundler's true module
graph). The analysis is a pure function, unit-tested directly:

```ts
analyzeComponentGraph(inputs: string[], opts: { modules: number; perPackage: number })
  → { total: number; overBudget: boolean;
      packages: { name: string; count: number }[];  // sorted desc
      barrels: { name: string; count: number }[] }   // packages over perPackage
```

- **Total budget (F):** `total = inputs.length`; `overBudget = total > opts.modules`.
- **Barrel detection (G):** group inputs by owning package — the path segment after
  the last `node_modules/`, honoring an `@scope/name` — and flag any package whose
  module count exceeds `opts.perPackage`. This names the offending dependency (e.g.
  an icon set pulling in hundreds of modules) directly from the real graph, with no
  heuristic resolver.
- A component whose worker build **crashed** is a hard phase failure carrying the
  attributed diagnostic (the budget warning's escalation: it already crashes).

Warnings are advisory; under `--strict` they fail the phase — mirroring
`structure-check`. The phase is included in a no-flag `display-case check` (the
"all phases" run) but **not** in the slim `--structure --tokens --ssr` lint gate
(it builds every component, like a publish), so the fast pre-commit gate stays
fast. Running `display-case check --graph` runs it alone.

### D5 — Config: optional `check.graphBudget`

`defineConfig` gains an optional nested field:

```ts
check?: {
  defaultPhases?: { … }            // existing
  graphBudget?: { modules?: number; perPackage?: number }
}
```

Defaults (used when unset): `modules: 1500`, `perPackage: 400` — high enough that
only genuinely dangerous graphs/barrels fire, conservative because the real crash
threshold is size-deterministic but machine-dependent. Documented as advisory
early-warning, not a hard guarantee. The field is additive and optional; existing
configs and the public type surface stay backward-compatible (a `*.test-d.ts`
assertion covers the new optional shape).

### D6 — Reporting

The graph phase reports through the existing `check-reporter` tally: a per-component
line with its module total, a warning line per over-budget component and per barrel
package (naming the package + count + a "import only what you use" hint), and the
phase summary counts. A crashed component is an error line. No new reporter
abstraction.

## Risks / Trade-offs

- **Publish spawn overhead.** One child per bundle adds process-startup cost; the
  bounded pool runs per-component builds concurrently, so wall-clock is comparable
  to or better than today's serial in-process builds. Worth it for crash immunity.
- **Graph phase cost.** It builds every component; hence it is excluded from the
  slim gate and opt-in to the full check. Documented.
- **Budget thresholds are advisory.** The true crash size is machine-dependent, so
  the defaults are deliberately loose; the value is *early warning + attribution*,
  not a precise predictor. Configurable so a team can tighten them.
- **Descriptor surface.** The `publish` worker kind accepts parent-computed
  `define`/`external` — scoped to the already-safe `BUN_PUBLIC_*`/`NODE_ENV` and a
  fixed React-external list, so nothing secret is serialized.

## Migration

None. No public authoring API removed or changed; `check.graphBudget` is optional;
addresses/manifest/published-artifact contracts are unchanged. The graph phase is
new behavior, not a change to existing phases.
