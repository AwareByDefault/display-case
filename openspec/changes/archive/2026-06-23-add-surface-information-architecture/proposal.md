## Why

Display Case organizes the whole catalog along a single axis: the Atomic-Design
level. That axis is right for the reusable kit — atoms read up to templates in
order of composition — but it does not scale for **pages and flows**. A real
application has dozens or hundreds of screens, and collapsing them all under one
`Pages` heading and one `Flows` heading produces a long, flat, alphabetical list.
With little horizontal room in the rail, authors resort to encoding structure
into the *name* (`Settings — Billing — Invoices`) purely so the alphabetical sort
groups related screens — a fragile prefix hack. Pages and flows are not naturally
ordered by composition; they are naturally ordered by the application's own
**information architecture** (feature area / route hierarchy), which the codebase
already encodes in folder layout but the showcase throws away. Forcing the kit's
composition axis and the app's IA axis into one list is the root problem.

## What Changes

- **Split the catalog into two browse modes**, so each has a single, consistent
  grouping logic instead of two competing ones in one rail:
  - **Components** — the building-block kit (atom through template), grouped by
    level exactly as today.
  - **Exhibits** — the application's pages and flows, grouped by their
    information architecture.
  - These extend the existing Primer/Cases mode switch into a three-way switch
    **Primer · Components · Exhibits**; a mode with no content is not offered (no
    primer → `Components · Exhibits`; a kit-only package → no Exhibits mode).
- Introduce a nestable **information-architecture group** axis for the Exhibits
  mode. A surface's group is a path (e.g. `App / Settings / Billing`), so groups
  nest.
- **Resolve a surface's group in layers**, first match wins: an explicit
  declaration on the case → derived from the case file's location among the
  discovered sources → a showcase-level mapping → a default catch-all group. Zero
  config keeps working: folder layout becomes the IA for free.
- **Keep the Atomic-Design level** on every component, including pages and flows
  — it still drives composition/structure checks and the Components mode's
  grouping. Level and IA group are independent axes.
- **Configurable IA curation** on the showcase: declare group order, rename a
  group's display label, and mark groups collapsed by default.
- **A text filter in both modes** to locate a component, case, or group by name
  at scale; a match in the other mode is reachable, so the viewer can jump
  straight from an Exhibit to a Component it composes.
- **Expose the resolved group path** in the machine-readable manifest (per
  component, plus the overall group structure) and present the active Exhibit's
  group path as a breadcrumb for orientation.
- Keep the new `group` (a navigation/IA concern) **distinct from the existing
  `area` tag** (a decorator/chrome concern); they may coincide but are not the
  same field.
- **Distinguish flows from pages** in the Exhibits listing: a flow carries a
  high-visibility `flow` tag (default) or a leading glyph (`nav.flowMarker`) and
  its steps are numbered; pages render plain.
- **Make the nav rail width adjustable and remembered** — drag its right edge (or
  use the keyboard) between a minimum and a maximum, with the chosen width kept
  across sessions, to fit deeper indentation and longer surface names.
- **Collapse the rail to a drawer on compact viewports** — on a narrow (phone)
  screen the open rail overlays the stage as a full-width drawer and is otherwise
  hidden, so it doesn't crowd the preview; choosing an item closes it.

A considered alternative — stacking both axes as two regions in a single rail
rather than two modes — is documented in `design.md` and kept as a fallback. No
breaking changes: with no group declared and no IA config, the Exhibits mode
presents pages and flows as a single default group, matching today's listing.

## Capabilities

### New Capabilities
- `information-architecture`: a nestable grouping axis for pages and flows
  (the Exhibits mode) derived from explicit metadata, source location, or
  configuration; configurable group order/labels/default-collapsed state; and
  presentation of a surface's group path for orientation.

### Modified Capabilities
- `browsing-surface`: the catalog is presented as two browse modes — a Components
  mode (kit grouped by level) and an Exhibits mode (pages/flows grouped by IA) —
  and gains a text filter that narrows either mode and reaches matches across
  modes; the rail is width-adjustable (remembered across sessions) and collapses
  to a full-width drawer on compact viewports.
- `primer`: the primer switch becomes one of a three-way mode switch alongside
  the Components and Exhibits browse modes, offering only the modes that have
  content.
- `hierarchy`: clarifies that the declared level classifies every component for
  composition but that pages and flows are organized for browsing by their IA
  group (the Exhibits mode), while the building-block levels stay grouped by
  level (the Components mode).
- `information-architecture` (also): flows are visually distinguished from pages
  in the Exhibits listing (marker + numbered steps), with a configurable marker
  style.
- `discovery-and-manifest`: the catalog additionally exposes each component's
  resolved IA group path and the overall group structure.

## Impact

- **Authoring API** (`src/index.ts`): `CaseMeta` and `defineFlow` gain an optional
  `group` (string path or segments); `DisplayCaseConfig` gains an optional nav/IA
  block (group order, label overrides, default-collapsed, the page/flow→group
  derivation rules, and `flowMarker`). `area` is unchanged.
- **Model & discovery** (`src/core/`): catalog/manifest resolve and carry each
  component's group path and build the overall group index; group resolution
  reads `sourcePath` relative to the matched discovery root.
- **Browse chrome** (`src/ui/`, `src/render/`): the mode switch
  (`SegmentedToggle`, `shell-core` `Mode`) extends to `primer | components |
  exhibits` with empty modes omitted; the Exhibits mode renders the nested,
  collapsible IA tree with a breadcrumb; both modes gain a filter input; new
  `src/ui/test-ids.ts` entries + e2e coverage.
- **Checks**: structure checks unaffected (they read `level`, retained); a new
  static check MAY validate IA config (unknown group in `order`/`labels`).
- **Docs/specs**: new `openspec/specs/information-architecture/`; updates to
  `docs/hierarchy.md`, `docs/configuration.md`, `docs/writing-cases.md`,
  `display-case.prompt.md`, and `contributing/NOTES.md`.
- **No runtime impact** on a published showcase or a consuming application —
  Display Case remains development-only.
