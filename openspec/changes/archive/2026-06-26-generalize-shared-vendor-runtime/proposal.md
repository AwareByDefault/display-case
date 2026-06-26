## Why

The published build delivers the shared UI **rendering runtime** (React) once — a
single content-hashed vendor bundle that every surface references via an importmap,
instead of inlining a ~150 KB copy into each per-component bundle. That win was
scoped, deliberately, to React: `VENDOR_MODULES`, the externals list, and the
importmap keys are three independently-hardcoded four-entry React sets.

But the duplication those lists fix is **generic**, not React-specific. The
crash-containment design builds the catalog as one isolated `Bun.build` per
component (no pass ever holds the whole catalog), which defeats `splitting` across
components — so *any* code shared across the per-component bundles still inlines
once per surface:

- a consumer's **CSS-in-JS engine** (emotion / styled-components) — and these are
  *correctness*-critical singletons, not merely a size cost: two instances mean a
  split style cache / context and broken styling, the same class of bug `pinReact`
  exists to prevent for React;
- `markdown-to-jsx` and any other library a markdown/placard surface pulls in;
- a shared icon set, date library, or utility;
- in **monorepos**: peer dependencies shared across packages, and **internal
  workspace packages** that many components import.

The external + shared-bundle + importmap *mechanism* already generalizes. What is
hardcoded is the *list*. This change turns "React, in three hand-maintained lists"
into one computed shared-runtime set, and lets an author share more than the
rendering runtime — without weakening per-component crash-containment, static-export
parity, render-before-scripting, or worktree-safe resolution.

## What Changes

Delivered in three independently shippable phases.

- **Phase 1 — Generalize the mechanism (no behavior change).** Collapse the three
  hardcoded React lists into one `SharedRuntime` descriptor computed once per
  publish, from which the `external` list, the vendor entrypoints, and the importmap
  are all derived (so they can never drift). Build all shared specifiers in **one
  bounded `Bun.build` with `splitting: true`** — allowed because the vendor set is
  small and bounded (never the catalog), and splitting then dedupes cross-package
  internals (e.g. the reconciler shared by `react-dom` and `react-dom/client`) for
  free. Default set stays React-only, so output is byte-identical to today. Ships
  under the existing spec.
- **Phase 2 — Author-declared shared libraries.** A new `share?: string[]` config
  field. Listed packages (a style engine, `markdown-to-jsx`, a shared util, **or a
  monorepo workspace package**) are resolved from the consumer package, shared once
  on the client, and routed through the importmap — which *also* collapses each to a
  single instance, the general form of `pinReact`. A use the build cannot route
  (an undeclared deep import) falls back to inlining rather than failing. Published
  peers are also externalized from the SSR renderers and added to the generated
  showcase `package.json`; repo-internal packages, which have no registry
  coordinates, are bundled into the SSR renderers (server-side disk, not client
  bytes) while still shared on the client.
- **Phase 3 — Duplicate-runtime reporting.** Publish reports which libraries are
  inlined across more than one surface (read from the module graphs already
  recorded per build) and how much that duplicates, recommending `share` entries —
  making the size-only opportunities visible without auto-imposing sharing (which,
  because the shared form retains a library whole, can regress total bytes for a
  rarely-shared library).

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `publishing`:
  - **Modifies** the *Shared runtime delivered once* requirement — broadens it from
    "the rendering runtime" (singular) to the rendering runtime plus any
    author-declared shared library, per-library content-addressed, holding whether a
    library is published independently or defined within the same repository.
  - **Adds** an *Author-declared shared libraries* requirement — an author MAY
    declare further runtime libraries to be delivered once; each declared library is
    routed to a single instance every surface resolves to (single-instance
    correctness), with a render-correct inlined fallback for any use the build cannot
    route.
  - **Adds** a *Reporting duplicated runtime* requirement — the build reports
    libraries inlined into more than one surface as sharing candidates, without
    altering or failing the build.

## Impact

- **Affected code:** `src/commands/publish.ts` (compute the `SharedRuntime`
  descriptor; one multi-entry `splitting` vendor build; derive `external` /
  entrypoints / importmap from it; generalize the generated `package.json`
  dependencies; split SSR treatment of published vs. repo-internal shared packages;
  Phase 3 duplicate report), `src/render/documents.ts` (emit the importmap from a
  specifier→URL map rather than four hardcoded keys), `src/index.ts` (the
  `share?: string[]` config field + types), `src/server/prod-server.ts` (thread the
  importmap map into the render document). The build worker already plumbs an
  `external` list, so no worker-protocol change.
- **Isolation preserved.** The vendor build remains one small, isolated,
  crash-contained worker build (the bounded shared set, not the catalog), so the
  `scalable-serving` guarantee is untouched. Splitting is used *only* within that
  bounded build — never across the per-component catalog.
- **Backward compatible.** With no `share` configured, the default set is React and
  the published output is byte-identical to today. `share` is additive and optional.
- **Spirit preserved.** Render-before-scripting is unchanged (the importmap is
  `<head>` markup before any module script); static-export parity holds (the
  importmap is just markup); resolution stays `pkgDir`-anchored (worktree-safe);
  no new runtime dependencies.
