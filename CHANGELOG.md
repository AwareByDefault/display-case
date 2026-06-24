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
