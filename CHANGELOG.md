## 1.6.1

### Patch Changes

- 5351c16: Themed render documents now declare a CSS `color-scheme` matching the requested
  theme, so user-agent-rendered surfaces (scrollbars, default form-control and
  `<button>` chrome) follow the theme instead of rendering in their light defaults.
  Previously a dark-themed preview kept light user-agent controls — most visibly a
  bare `<button>` showing the light `ButtonFace` background — which skewed dark
  snapshots and produced misleading `color-contrast` results against light control
  surfaces. The client keeps the color scheme matched across in-place theme swaps.

## 1.6.0

### Minor Changes

- b9ff9ba: `check --ssr` now diagnoses a dual-React environment instead of blaming your
  components. When the check's renderer resolves a different React instance than
  your cases use (the classic `bunx @awarebydefault/display-case` run from a
  directory that doesn't depend on the tool, which pulls a second React into a temp
  prefix), every hook-using case used to throw `resolveDispatcher() … useState` and
  get misreported as "can't render before scripts — move browser APIs into
  effects/handlers, or declare the component `browserOnly`." That turned one
  environment fault into hundreds of false "fix your component" findings.

  The `ssr` check now detects the condition once — by runtime module identity, not
  path — and reports a single environment fault that names **both** React copies
  (path + version), classifies the cause (a `bunx`/temp install, a real version
  conflict, or an un-deduped duplicate), and prescribes the exact fix, including the
  nearest `package.json` to add the tool to. It explicitly steers you away from
  component edits and `browserOnly`, and skips the per-case sweep that would only
  manufacture false positives. A runtime-symptom safety net collapses the findings
  even when the up-front probe can't run. Healthy single-React showcases — and
  hook-free showcases that need no React — are unaffected.

## 1.5.0

### Minor Changes

- 8e9d3da: Publish: deliver shared runtime libraries once, beyond React (`config.share`)

  A published showcase already ships React **once** (a shared vendor bundle every
  surface references via an importmap) instead of inlining it into every per-component
  bundle. That mechanism now generalizes: a new optional `share?: string[]` config lists
  any further runtime library — a CSS-in-JS engine, `markdown-to-jsx`, a monorepo
  workspace package — to deliver once the same way.

  - One descriptor drives the externals, the vendor entrypoints, and the importmap, so
    they can't drift; the bounded vendor set is built in a single `splitting` pass that
    dedupes shared internals (the catalog stays one isolated build per component).
  - Sharing a library also collapses it to a single instance — what a stateful library
    (a style cache/context) needs to behave correctly.
  - Monorepo-aware: a published shared package is kept external on the SSR renderers and
    added to the generated `package.json`; a repo-internal workspace package is shared on
    the client but bundled into the SSR renderers (no registry coordinates).
  - `display-case publish` now reports libraries inlined across more than one component
    as candidates for `share`.

  No change for existing users: with nothing declared, React is still shared and the
  output is unchanged.

## 1.4.5

### Patch Changes

- 6812040: chore(deps): bump pixelmatch from 6 to 7. The built-in visual-diff provider's optional dependency; the default-import API is unchanged.

## 1.4.4

### Patch Changes

- 3faa293: Deliver React once in a published showcase instead of inlining it into every
  bundle. The catalog is split into one isolated browser bundle per component (the
  crash-containment design), and each previously carried its own ~150 KB React copy —
  so the published assets duplicated React N+ times and a client browsing N components
  downloaded N copies. React is now built once into a shared, content-hashed vendor
  bundle that the chrome and every per-component bundle reference via an `<script
type="importmap">` (React is marked external in those builds); it works for both the
  host-served build and the static export. Measured on a 35-component showcase:
  per-component bundles drop ~191 KB → ~6 KB and total published assets ~7.2 MB →
  ~1.2 MB, with React downloaded once site-wide. Adds the `publishing` "shared runtime
  delivered once" requirement.

## 1.4.3

### Patch Changes

- 574c82f: Bound a hung surface preparation. A build worker (or the `--print-manifest`
  subprocess) that neither completes nor crashes — a never-resolving top-level
  `await`, a spinning plugin — previously held its bounded concurrency slot forever,
  silently wedging all further preparation while the server still answered `/health`.
  Each preparation now has a generous, configurable time bound
  (`DISPLAY_CASE_BUILD_TIMEOUT`, default 120s): on expiry the worker is killed and the
  hang is reported as a contained per-surface failure (distinct from a bundler crash),
  the slot is released, and the tool keeps serving every other surface. Extends the
  `scalable-serving` "isolated, diagnosed preparation failure" guarantee from two
  failure modes (logical build error; bundler crash) to three (adds a hang).

## 1.4.2

### Patch Changes

- e76f589: Stability, speed, and bundle-size hardening (no public API change):

  - **Dev-server speed:** a rebuild now reuses the surfaces a change can't have
    touched — a component _implementation_ edit no longer re-runs the catalog-size
    manifest subprocess or rebuilds the chrome; the manifest, chrome build, and
    global-CSS read run concurrently; and overlapping rebuilds are coalesced instead
    of racing.
  - **Stability:** the `.display-case/ssr` cache no longer grows unbounded (prior
    seq-named bundles are pruned per build and swept at startup); the interactive
    dev server tears down cleanly on SIGINT/SIGTERM (closes the a11y browser,
    unsubscribes watchers, kills in-flight build workers); the Playwright driver no
    longer leaks a page on a failed navigation and bounds navigation at 15s; the
    prod/dev static-asset handlers are hardened against path traversal; and
    `Bun.serve` returns a sanitized 500 on a handler throw.
  - **Bundle size:** the npm tarball no longer ships tests, dogfood cases, placard
    docs, or fixtures (267 → 142 files); published SSR server bundles are minified.
  - **Toolchain:** `noUncheckedIndexedAccess` and Biome's `noFloatingPromises` are
    enabled (a real unhandled doc-fetch rejection was fixed); `@types/react(-dom)`
    are declared optional peers; Dependabot and a `bun audit` CI job are added.

## 1.4.1

### Patch Changes

- b95b00c: Start the dev/prod server listening before the initial build, so its `/health`
  endpoint is reachable immediately instead of waiting on the cold build
  subprocesses. Browse routes still serve the fully-prepared showcase (they await
  the build), but a liveness check no longer blocks on it — which keeps Playwright's
  `webServer` readiness check (and any hosting health probe) from timing out when
  several servers boot at once on a constrained CI runner.

## 1.4.0

### Minor Changes

- 232efcc: Harden the publish path and add a bundle-graph budget check.

  - **`publish` now runs every bundle in a fresh child process** (the same crash-contained build worker the dev server uses), so publishing a large showcase can no longer accumulate Bun bundler heap state and segfault mid-build. A surface whose bundling crashes the bundler fails publish with a clear, attributed diagnostic and a non-zero exit instead of a native panic — covering the host-served, `--static`, and SSR forms. Per-component builds also run concurrently through a bounded pool.
  - **New `display-case check --graph` phase**: measures each component's real bundled module graph and warns when it exceeds a budget or when one dependency dominates it (a barrel import, e.g. importing a whole icon set), naming the offending package. Budgets are configurable via `check.graphBudget` (`modules`/`perPackage`); warnings escalate to errors under `--strict`. It builds each component in isolation, so it runs in a no-flag full check but is excluded from the fast `--structure --tokens --ssr` gate.

## 1.3.1

### Patch Changes

- 3c66911: Fix a segfault when running the dev server (`--dev`) against a large showcase.
  Per-component bundling alone wasn't enough: the long-lived server still ran Bun's
  bundler in-process (the browse-chrome build), and the bundler's heap state
  accumulating in that process is what corrupts and crashes ("a bug in Bun, not your
  code") on a large catalog.

  Now **all** Bun bundling — the chrome build and every per-case build — runs in a
  fresh, short-lived child process whose heap dies with it (the same isolation the
  manifest load already used); the server only orchestrates and serves the bytes.
  The server never calls the bundler itself, so it can't accumulate the heap state
  that crashes. A bundler crash on any surface is contained and reported (the tool
  keeps running, the chrome falls back to a diagnostic) instead of taking the whole
  process down with a native panic.

  Build concurrency is bounded (`DISPLAY_CASE_BUILD_CONCURRENCY`), and the preview
  frame now loads just after the chrome rather than blocking the initial page load,
  so a first-visit build never stalls navigation. Set `DISPLAY_CASE_TRACE=1` to log
  startup build/manifest timings.

## 1.3.0

### Minor Changes

- 8bbffb5: Bundle each component separately instead of the whole catalog as one module
  graph — removing the precondition for a Bun-bundler segfault on large showcases
  (≈100+ cases that transitively import real application code and large vendor
  libraries).

  - **Dev server**: builds each component's render + SSR bundle the first time that
    component is requested, rather than pre-bundling the whole catalog at startup.
    Startup is now independent of case count. A component whose bundle fails to
    build is isolated and shown as a chrome-free diagnostic (component + source
    file) while every other component keeps serving.
  - **`publish`**: builds the chrome once, then each component into its own
    content-hashed browser + SSR bundle; the production server serves each
    component's own bundle. A large showcase now publishes without crashing.

  Behavior note: in the dev preview, switching between two different components now
  reloads the preview frame (each component is its own bundle); switching case
  variants, tweaks, or theme within a component is still an in-place swap.

## 1.2.0

### Minor Changes

- f40a0f7: Add page & flow information architecture. The catalog is now browsed in two
  modes — **Components** (the building-block kit, grouped by Atomic-Design level as
  before) and **Exhibits** (pages and flows, grouped by a nestable
  information-architecture tree) — alongside the optional **Primer**, via a
  three-way mode switch that shows only the modes present. A surface's group
  resolves from an explicit `meta.group` / `defineFlow({ group })`, else its case
  file's folder, else a new `nav` config block (`deriveFromFolder`, surface→group
  rules, group `order`/`labels`/`collapsed`), else a default group. A sidebar
  filter narrows either mode (surfacing cross-mode matches), and the active
  surface's group path shows as a stage breadcrumb.

  The browse address now encodes the mode as a path prefix — `/c/<component>/<case>`
  for Components, `/e/<component>/<case>` for Exhibits — while `/render/...` stays
  unified. `landing` accepts `'primer' | 'components' | 'exhibits'` (honored when
  present, else the first present mode), replacing `'primer' | 'cases'`. The
  manifest exposes each component's resolved `group` and the overall `groups` tree.
  In Exhibits, a flow is distinguished from a page by a high-vis `flow` tag
  (default) or a leading glyph (`nav.flowMarker: 'tag' | 'glyph'`) plus numbered
  step rows. The sidebar's right edge is draggable to resize it (width remembered
  across sessions). A `nav-groups-resolve` structure check warns when `nav` config names a
  group no surface resolves to. `level` is unchanged and still drives the structure
  checks.

## 1.1.1

### Patch Changes

- ddce4b8: Dev watcher now follows the bundle's module graph, so editing a workspace
  sibling resolved to source (an `exports`/`main` pointing at `./src/...` with no
  build step) triggers a rebuild and live-reload when viewing it through a
  consuming app's cases. Previously only the target package's `src` was watched,
  so sibling edits silently served a stale bundle until an unrelated edit inside
  the target forced a re-bundle.

## 1.1.0

### Minor Changes

- 2d74a90: Report the `display-case check` a11y and visual-regression phases like `bun test`.
  Every variant is now a "test" with a `(pass)` / `(fail)` / `(record)` tag and its
  own elapsed time (`Bun.nanoseconds()`), followed by a rolled-up summary — per-phase
  counts, the overall `N pass` / `N fail`, and a `Ran N checks [wall-clock]
(concurrency K)` line. The fixed-text tags carry no colour or glyphs, so a CI step
  can grep and tally them the same way it summarizes a test run.

  Variants now scan concurrently (default 4) instead of serially, each on its own
  page from the shared browser, cutting wall-clock well below serial. Tune it per run
  with `--concurrency=N` or globally with `check.concurrency`. The overall verdict and
  0/1 exit code are unchanged, so it remains a drop-in CI gate.

## 1.0.2

### Patch Changes

- 81b924f: Fix duplicate-React in the browser bundle that broke hook-using components
  ("Invalid hook call … more than one copy of React"). Display Case's client
  runtime resolved `react`/`react-dom` from its own install while the consumer's
  cases resolved them from the project, so a `bunx` temp install pulled two React
  copies. A new `pinReact` bundler plugin forces every `react`/`react-dom`
  specifier to resolve from the consumer project, collapsing them to one copy
  across the dev browser, dev SSR, and publish browser builds.

## 1.0.1

### Patch Changes

- 4e1974a: Compile a consumer's Markdown/MDX primer against Display Case's own copy of
  `markdown-to-jsx`. The compiled primer is loaded from inside the consumer's tree,
  so the previously-emitted bare `import 'markdown-to-jsx'` resolved from the
  consumer — failing with `Could not resolve "markdown-to-jsx"` unless the consumer
  redeclared the dep. The plugin now resolves the package from Display Case's own
  install and emits an absolute path, so authoring a `primer.md`/`primer.mdx` no
  longer requires the consumer to add `markdown-to-jsx`.

# 1.0.0 (2026-06-22)

### Bug Fixes

- clear Biome CSS lint warnings in design-system stylesheets ([e012912](https://github.com/AwareByDefault/display-case/commit/e012912b876ca5e429bbba207c2c9df89f6cc7eb))
- use npm-normalized bin path so the CLI survives publish ([ce5a492](https://github.com/AwareByDefault/display-case/commit/ce5a492929e8f852fd585511444185de3fa73029))

### Features

- add a render-time CSS-in-JS style-engine seam ([e184cdc](https://github.com/AwareByDefault/display-case/commit/e184cdc11200c742d58e6ab24c80974cba8406ce))
- add mdx-lite, a dependency-free constrained-MDX to TSX compiler ([d4d64a0](https://github.com/AwareByDefault/display-case/commit/d4d64a081531d383edae786d2824b7ae778d3c93))
- extract Display Case into a standalone repository ([b9cd8ba](https://github.com/AwareByDefault/display-case/commit/b9cd8ba60bebf368a7ad2d26352d356bf10ba9d9))
- render markdown via markdown-to-jsx and mdx-lite, dropping the unified/MDX stack ([4770f7f](https://github.com/AwareByDefault/display-case/commit/4770f7fa013b48a9533373d816ac7d75f6ebf6b8))
- server-inline the Vitrine CSS ([c527490](https://github.com/AwareByDefault/display-case/commit/c52749049cfb1304bbf34e775c2a30793a1bb429))
- set up npm publishing as @awarebydefault/display-case ([6f4aca6](https://github.com/AwareByDefault/display-case/commit/6f4aca69639b8d6a35288190746eaf86490fef25)), closes [oven-sh/bun#30522](https://github.com/oven-sh/bun/issues/30522) [#24855](https://github.com/AwareByDefault/display-case/issues/24855)
