## Context

Today `rebuild()` (`src/server/server.ts`) discovers every case, codegens one
render entry and one SSR entry that each **statically import all cases**
(`codegenRenderEntry` / `codegenSsrEntry` in `src/core/discovery.ts`), and runs
**one `Bun.build` per target** over that single all-cases graph. `publish()`
does the same. When cases are heavy (page/flow surfaces importing real app code +
large vendor barrels like `@phosphor-icons/react`), the aggregate graph crosses a
threshold and Bun's bundler segfaults — a native crash before the server listens.

The crash is reproducible, version-independent (Bun 1.2.21 → 1.4.0-canary), and a
function of **aggregate per-pass graph size**, not any one case: a single heavy
case builds fine; ~50 together crash even with the icon library trivialized.
`--print-manifest` (which evaluates every case module but runs no `Bun.build`)
succeeds — so module *evaluation* is fine; *bundling the combined graph* is what
fails. Source bug report:
`30-day-cohorts-webapp/display-case-bundler-segfault-report.md`.

Constraints that shape the design:
- **Render purity / determinism** must hold — a surface renders identically
  server and client; on-demand preparation must not change the delivered result.
- **Worktree-safe** — all build cache stays anchored under the targeted
  package's `.display-case/` cache dir (already true); no global state.
- **Dependency-light, zero-config** — the common path must keep working with no
  new configuration. Bun's bundler is the only bundler; no Vite/esbuild.
- **One React** — `pinReact` already collapses the tool's runtime and the
  consumer's components onto a single React copy to avoid the dual-React hazard,
  in both the browser and in-process SSR bundles. Any externalization must
  preserve that.

## Goals / Non-Goals

**Goals:**
- Remove the single-giant-graph precondition so a showcase of any size starts,
  serves, and publishes without crashing Bun's bundler.
- Make dev-server startup independent of case count (prepare cases on demand).
- Contain and attribute a single case's preparation failure (including a native
  bundler crash) instead of taking down the whole showcase.
- Keep total bundle size sane by not duplicating heavy shared deps across cases.

**Non-Goals:**
- Fixing the upstream Bun bundler crash (file it separately; do not depend on it).
- A `display-case check` graph-budget phase or a barrel-import lint warning
  (report items F/G) — possible follow-ups, out of scope here.
- Changing any case-authoring API, the manifest shape, addresses, or the
  published-build deployment contract.

## Decisions

### D1. Per-case entries replace the all-cases barrel (core)

Codegen **one entry per case** (render + SSR), each importing only that case
module + config, instead of one entry importing all. Each `Bun.build`
invocation then traverses **one case's** graph, bounding per-pass size below the
crash threshold regardless of catalog size. The render-mount path changes from
"mount the whole case list" to "mount the one requested case"; the manifest
(catalog) is still built from discovery, independent of bundling, so enumeration
is unaffected.

*Alternative rejected — recommendation A (one entry, `import()` per case +
`splitting: true`):* `Bun.build` still parses and holds the **entire transitive
graph in one pass**; `splitting` only changes output chunking, not whether the
whole graph is loaded at once. It would not bound per-pass size and so would not
reliably dissolve the crash. The decisive lever is *multiple separate build
invocations*, not output splitting.

### D2. On-demand build with a per-case disk cache (dev) — report item B

The dev server starts and serves the browsing surface immediately (it already
has the manifest). A case's render + SSR bundles are built **on first request**
to its address and cached on disk under the package's `.display-case/` cache,
keyed by case id + a hash of its input graph. Subsequent requests serve the
cached build until inputs change. Startup cost becomes O(1) instead of O(all
cases). An optional background warm pass MAY pre-build popular/visited cases
after listening, but is never on the startup critical path.

### D3. Shared "commons" bundle + externalized vendors — report item D

Per-case isolation would otherwise duplicate React, the chrome runtime, and
heavy vendor libs into every case bundle (huge total size, slow). Build a single
**commons bundle once** — the React runtime (via `pinReact`), the browse/render
mount runtime, and shared heavy dependencies — and have each per-case build
treat those modules as **external**, resolved at load time:
- **Browser:** an import map maps the externalized bare specifiers to the
  commons chunk URL; the per-case chunk excludes them.
- **SSR (`target: 'bun'`):** mark the same modules external and resolve them to
  the commons module the server already imports in-process, preserving the
  single-React guarantee.

Externalization policy: start conservative and automatic — React (already
pinned) plus dependencies shared across N+ cases or exceeding a module-count
threshold (the icon-barrel case). No new required config; an optional config
escape hatch MAY be added later if the heuristic needs tuning. This keeps the
common path zero-config.

### D4. Build isolation + graceful degradation — report item E

Run each per-case `Bun.build` in a **subprocess** (not the host process) so a
native bundler segfault becomes a non-zero/abnormal **exit of that child**,
attributable to the case being built, rather than a crash of the dev server.
The server catches the abnormal exit, marks that case as failed, serves a
diagnostic error surface for it (component / case / source file + the bundler
logs), and **keeps serving every other case**. This holds even if D1–D3 ever
leave a single case's graph large enough to crash: the blast radius is one case.
The publish path applies the same isolation and fails the build with a
case-attributed error rather than a bare crash.

### D5. Bounded publish passes sharing the commons bundle — report item C

`publish()` builds the commons bundle once, then builds cases in **bounded
units** — per case, or grouped by the existing Exhibits information-architecture
`group` — each referencing the commons bundle as external, and merges the
content-hashed outputs into the build descriptor / asset manifest. The published
output stays a standalone, dev-free, deployable showcase; only its internal
chunking changes (one chunk per case/group + a shared commons chunk) — observable
behavior is unchanged.

### D6. Live-reload invalidation follows the per-case input graph

`graphRecorder` already records the real module graph of each build. Persist
each case's recorded input set so a file edit invalidates exactly the cached
cases whose graph includes it; editing a commons/shared module rebuilds the
commons bundle and invalidates all dependent cases. The current selection is
preserved across the update, as today.

## Risks / Trade-offs

- **First-request build latency** (cold case feels slower than a pre-built one)
  → on-disk cache makes it one-time per input-hash; optional post-listen
  background warm pass hides it for common cases.
- **Externalization correctness across SSR + browser** (a mis-externalized
  module could split React or break a case) → reuse `pinReact`'s resolution for
  the commons bundle; keep exactly one React; assert single-React in a test; keep
  the externalized set small and explicit.
- **Vendor heuristic mis-selects** what to externalize → start with React + a
  conservative shared/heavy threshold, measure on the repro showcase, expose an
  optional config override only if needed.
- **Subprocess build overhead** (spawn cost per case) → amortized by the cache
  (build once per input-hash); commons built once; acceptable for a dev tool.
- **Cache invalidation bugs** (stale case after an edit) → key the cache by input
  graph hash from `graphRecorder`; on hash miss, rebuild; this mirrors the
  existing fresh-import discipline that already forces sequence-named SSR bundles.
- **More moving parts than one `Bun.build`** → contained to `discovery.ts`,
  `server.ts`, and `publish.ts`; the public surface, manifest, and addresses are
  unchanged, so the contract stays small.

## Migration Plan

Internal redesign with no spec-contract change, so it can land incrementally:
1. Land per-case codegen (D1) + on-demand dev build/cache (D2) behind the
   existing dev path; verify the repro showcase boots.
2. Add build isolation + degradation (D4) — independently valuable, makes the
   rest debuggable.
3. Add the commons/externalization mechanism (D3) to cut total size.
4. Apply bounded passes to publish (D5) and per-case invalidation to live reload
   (D6).
Rollback is a revert; because addresses, manifest, and authoring are unchanged,
no consumer migration is required.

## Open Questions

- Externalization policy: pure auto-detection vs. an optional config allowlist
  for heavy vendors — decide after measuring on the repro showcase.
- Grouping granularity for publish (D5): strictly per-case vs. per-IA-`group` —
  per-group is fewer passes but larger graphs; pick the largest unit that stays
  safely under the crash threshold with margin.
- Whether the post-listen background warm pass ships in this change or as a
  follow-up.
