## Context

After `per-case-on-demand-bundling` (1.3.0), the dev server still runs `Bun.build`
in the long-lived main process in three places (`src/server/server.ts`):

- the **shell** build — `Bun.build({ entrypoints: [BROWSER_ENTRY, primerEntry?] })`
  at `rebuild()` (`:274`);
- the **primer SSR** build (`:310`);
- each **per-case** build, via `buildCaseBundles` in `src/server/build-case.ts`,
  called in-process from `buildCase` (`:677`) — this was a subprocess in an earlier
  iteration but was reverted because the per-build `bun` spawn timed out CI's a11y
  e2e on a contended runner.

The manifest load is already isolated: `loadManifestFresh` (`:231`) spawns
`bun <cli> <pkg> --print-manifest`, and that child `await import()`s the **entire**
catalog graph and exits 0 every time — the same graph that kills the main `--dev`
process. The crash is a Bun heap corruption (poison address `0x…AAAE`, variable
timing, size-deterministic) in the process that **hosts the bundler**. So the
precondition is *bundler heap state in a long-lived process*, not graph loading.

Constraints: the previous subprocess attempt regressed CI (a11y e2e
`page.goto(/c/broken/default, waitUntil:'load')` timed out at 45 s because the
stage iframe's first-visit build stalled under contention). Any reintroduction of
build subprocesses must also remove that failure mode. Render purity, worktree
safety, dependency-light, and the single-React (`pinReact`) guarantee all hold.

## Goals / Non-Goals

**Goals:**
- The long-lived dev server NEVER calls `Bun.build`. Every bundle is produced in a
  fresh, short-lived child whose heap dies with it — removing the crash precondition
  regardless of the exact Bun bug.
- A build child that dies on a **signal** (native segfault), not only one returning
  a logical error, is contained and attributed; the server survives.
- The reintroduced isolation does not regress CI: bounded build concurrency, and
  the stage frame no longer blocks page load on a first-visit build.
- `publish` is crash-contained and attributed too.
- Preventative checks surface a dangerously large graph / barrel import before it
  crashes.

**Non-Goals:**
- Fixing the upstream Bun heap bug (file it; don't depend on it).
- Rendering SSR markup in a child. Module *evaluation* (importing a built SSR
  bundle, `renderToString`) is proven safe — `--print-manifest` evaluates the whole
  catalog. Only *bundling* is isolated. (Kept as a fallback if evaluation ever
  proves unsafe — see Open Questions.)
- Changing case authoring, addresses, the manifest, or the publish artifact
  contract.

## Decisions

### D1. A single "build worker" child, spawned per build (generalize `loadManifestFresh`)

`src/server/build-case.ts` becomes the build worker: a CLI (`if (import.meta.main)`)
that takes a build **kind** + params, runs the `Bun.build`(s) for that one unit,
writes the outputs to the package's `.display-case/` cache, emits a JSON result on
stdout (`{ ok, inputs, error? }`), and exits — so its bundler heap dies. Kinds:

- `shell` — the browse chrome (`BROWSER_ENTRY`) + optional primer browser entry +
  primer SSR entry, in one child (a small, catalog-independent graph).
- `case <componentId> <file> <seq>` — one component's browser + SSR bundle.

The server spawns one child **per build** (not a persistent pool): a pooled worker
that served many builds would re-accumulate the very heap state we're isolating, so
each build must get a fresh process. This is the exact generalization of the
manifest child. *Alternative rejected — in-process builds (1.3.0):* proven to crash.

### D2. The main process is a pure orchestrator; it imports only SSR bundles

`rebuild()` spawns the `shell` build child (+ the manifest child) and reads the
on-disk shell/primer bundles; `buildCase()` spawns a `case` child. The server then
`import()`s the on-disk **SSR** bundle to get the pre-render function — evaluation,
not bundling, which is safe. The server never calls `Bun.build`. The child reports
its recorded module graph (`inputs`) as JSON so the dev watcher keeps following
source-resolved deps (as the per-case child already did).

### D3. Signal-death detection and attribution (extend the existing diagnostic)

Spawn with piped stdio; `await proc.exited`. Treat the build as **crashed** when the
child died on a signal or produced no parseable `{ ok: true }` result (Bun's
`proc.signalCode` / a non-zero `exitCode` with no JSON). Surface it as "bundling
`<surface>` crashed the bundler (likely the large-graph heap bug)":
- a `case` crash → the chrome-free per-case diagnostic 1.3.0 already serves for
  logical failures, now also for signal death; every other case keeps serving;
- a `shell` crash at startup → the server still binds and serves a diagnostic page
  for the chrome rather than the tool dying with a bare panic.

This converts a fatal native panic into a contained, labeled failure (report §6.C).

### D4. Bounded build concurrency

A small semaphore (cap = `clamp(cpus - 1, 1, 4)`, overridable) gates concurrent
build children. The earlier revert was an *unbounded* spawn storm under the a11y
scanner + e2e workers on 2 cores; a cap keeps the machine from oversubscribing while
still serving builds. `ensureCase`'s in-flight dedup already prevents duplicate
builds of the same component; the semaphore bounds distinct ones.

### D5. The stage frame must not block page load (the CI-regression fix)

Today the browse chrome sets the stage `<iframe>` `src` during hydration (in
`use-shell.ts`), so it becomes a pending subresource and the parent page's `load`
event waits for the iframe — which waits for the first-visit on-demand build. Under
contention that stalled `page.goto(..., waitUntil:'load')` to a 45 s timeout. The
chrome SHALL assign the stage `src` **after** the page's `load` event (e.g. on
`window` `load` / an idle callback), so a navigation completes on the chrome alone
and the first-visit build runs without blocking it. This is a progressive
enhancement — the case still appears, just not as a load-blocking subresource — and
it decouples build latency from navigation for real users and the e2e suite alike.

### D6. Publish is crash-contained and attributed

`publish` already builds each component in its own `Bun.build`, but in one process
(heap accumulates across the catalog) and a crash aborts with a bare panic. Publish
SHALL build each component in a build-worker child (bounded concurrency, reusing D1),
so no single process holds the whole catalog's bundler heap and a component that
crashes the bundler is reported with attribution. A published build must be complete,
so a crashed component **fails the publish with a clear per-component message**
(rather than silently shipping a showcase missing a component); the budget check
(D7) is the early-warning that prevents reaching that point.

### D7. Preventative checks — deferred to a follow-up

A `check` budget (flag a case whose recorded `inputs` graph exceeds a configurable
limit) and a barrel-import warning (a static heuristic over case sources naming an
index re-exporting many submodules, e.g. `@phosphor-icons/react`) are worthwhile
preventative lint. They are **out of scope for this change**: once bundling is
isolated and crash-contained (D1–D3), a too-large case fails gracefully with a
diagnostic instead of crashing the tool, so the lint is no longer load-bearing.
Tracked as a follow-up so this change stays focused on removing the crash.

### D8. Startup invariant logging (verification aid)

Behind `DISPLAY_CASE_TRACE` (or `--trace`), log wall-time and input counts around the
shell-build child, the config import, and the manifest child, so the
"size-independent startup" invariant can be confirmed on a large consumer (report
§6.B).

## Risks / Trade-offs

- **Spawn overhead per build** → bounded by D4, amortized by the per-component cache,
  and off the navigation critical path by D5. One extra startup spawn (shell). For a
  dev tool, acceptable; the alternative is a crashing tool.
- **CI contention recurrence** → D4 (cap) + D5 (no load-block) target the exact prior
  failure; verified by running the a11y e2e under `--workers=2` locally and on CI.
- **Signal detection portability** → rely on `proc.exited` + `proc.signalCode`; treat
  "no `{ok:true}` JSON" as crash regardless of platform signal specifics.
- **SSR import accumulates module state in the long-lived process** → evaluation, not
  bundler heap (proven safe by `--print-manifest`); one module per component, cached.
  If it ever proves unsafe, D2 extends to rendering in a child (Open Questions).
- **Publish per-component children are slower** → bounded concurrency; publish is a
  one-shot command, latency is acceptable, crash-safety is the win.
- **Budget false positives** → advisory + configurable + exemptible (D7).

## Migration Plan

Land incrementally, each step independently testable:
1. Build worker (D1) + case builds via child + signal detection (D3) + concurrency
   (D4) — restores per-case isolation correctly.
2. Shell + primer builds via child (D2) — removes the last `Bun.build` from the main
   process (the actual startup-crash fix).
3. Stage-frame load decoupling (D5) + update/verify the e2e suite — the CI fix.
4. Publish containment (D6).
5. Budget + barrel checks (D7) and startup tracing (D8).
Rollback is a revert; addresses/manifest/authoring are unchanged.

## Open Questions

- Concurrency cap value — measure on CI (start at `cpus-1`, clamp 1..4).
- Whether SSR rendering must also move to a child (only if importing built SSR
  bundles in the long-lived process ever shows instability — current evidence says
  evaluation is safe).
- Barrel-detection precision — start with a submodule-count heuristic + an allowlist
  of known barrels; refine from real findings.
