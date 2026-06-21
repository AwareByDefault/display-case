## Why

Display Case surfaces a per-variant accessibility verdict in the navigation, but
only for variants a viewer has actually opened — results are produced purely on
demand. On start-up the navigation shows no accessibility markers at all, even
when prior runs already cached results for every component. A reviewer who wants
an at-a-glance picture of which components have outstanding violations has to
click through the whole catalog to populate it, and there is no way to warm the
navigation or refresh stale results in one pass. This change lets the operator
choose, through configuration, how the navigation is populated at start-up.

## What Changes

- Add a configuration choice that controls how cached accessibility results
  populate the navigation when Display Case starts. Three modes:
  - **off** (default, current behavior): no start-up population; each variant's
    marker appears only once that variant is viewed.
  - **cached**: at start-up, ingest every existing cached result into the
    navigation markers without running any live scan. Variants with no cache
    entry remain unmarked until viewed; nothing affecting rendered output is
    re-scanned.
  - **refresh**: at start-up, scan every variant that has no cache entry plus
    every variant whose cache is stale (its rendered output has changed since
    the cached result), surfacing each verdict as it completes, while reusing
    fresh cached results without re-scanning.
- Start-up population in either active mode SHALL never block the browsing
  surface or the rendering of a variant, and the per-variant on-demand behavior
  when a variant is viewed SHALL be unchanged.
- When the choice is not configured, behavior is identical to today.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `display-case`: the "In-app accessibility surfacing" requirement gains a
  configurable start-up population mode (off / cached / refresh) governing how
  the navigation's accessibility markers are populated when Display Case starts,
  distinct from the existing on-demand-per-viewed-variant behavior.

## Impact

- Affected spec: `openspec/specs/display-case/spec.md` — "In-app accessibility
  surfacing" requirement.
- Affected code (implementation detail, see `design.md`): the Display Case
  package's accessibility scanner (bulk cache read / stale detection), the dev
  server start-up path (driving the chosen mode and broadcasting results), the
  showcase configuration schema (the new mode field), and the client navigation
  state (accepting a start-up batch of results).
- No product-facing (the host app) behavior changes; Display Case is a
  development-only tool excluded from application builds.
