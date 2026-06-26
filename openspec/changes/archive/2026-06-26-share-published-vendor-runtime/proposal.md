## Why

A published showcase splits its catalog into one isolated browser bundle per
component (the crash-containment design — no single bundler pass holds the whole
catalog). Each of those bundles, and the chrome and primer bundles, currently
**inlines its own copy of the UI rendering runtime** (~150 KB minified). On a
showcase with N components, that's the runtime duplicated N+ times across the
deployed assets, and a client browsing M components downloads M copies of it (each
cached separately, never shared). Measured on this repo's showcase (35 components):
the per-component render bundles totalled ~7.2 MB, ~5.25 MB of which was duplicated
runtime; a trivial component's bundle was ~191 KB, essentially all runtime.

The split is the right design for crash-containment, but the duplication is pure
waste: the runtime is identical across every surface. It should be delivered once
and shared.

## What Changes

- **The published build delivers the shared UI runtime once.** Common runtime code
  is emitted as a single shared resource that every surface references, rather than
  inlined into each per-surface bundle. Browsing N surfaces downloads that runtime
  once (cacheable), not once per surface.
- **No change to what any surface renders, or that it renders before scripting.**
  The shared resource is content-hashed and cacheable like every other asset, and
  the guarantee holds for both a host-served build and a fully static export.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `publishing`: adds a **Shared runtime delivered once** requirement — the
  deployable build SHALL NOT duplicate common runtime/vendor code into each
  per-surface bundle; it SHALL deliver shared code as one resource every surface
  references, so the bytes a client downloads to browse N surfaces don't include a
  per-surface copy of it. The existing pre-scripting, theming, caching, reproducible,
  and static-form guarantees are unchanged.

## Impact

- **Affected code:** `src/commands/publish.ts` (build one shared vendor bundle from
  the consumer's installed runtime; mark the runtime external in the chrome and
  per-component browser builds so they reference it rather than inline it),
  `src/render/documents.ts` (emit, in each document, the resolution map that points
  the externalized bare specifiers at the one shared bundle), `src/server/prod-server.ts`
  (thread the shared-bundle URL into the isolated render document). The build worker
  already supports an external list, so no worker change.
- **No public API or authoring change.** Addresses, the manifest, case authoring,
  and the served documents' content are unchanged; only the asset topology differs.
- **Isolation preserved.** The shared bundle is one more small, isolated,
  crash-contained worker build (just the runtime, not the catalog), so the
  `scalable-serving` isolation guarantee is untouched.
- **Measured:** per-component bundles drop from ~191 KB to ~6 KB; total published
  assets from ~7.2 MB to ~1.2 MB on this repo's 35-component showcase, with the
  runtime downloaded once across the whole site.
