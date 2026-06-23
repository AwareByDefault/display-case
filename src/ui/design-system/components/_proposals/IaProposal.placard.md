# IA Proposal — wireframes

Throwaway wireframes for the **`add-surface-information-architecture`** change
proposal — not a shipping component. They compose the real Vitrine nav
primitives (`Sidebar`, `Eyebrow`, `NavItem`, `Chip`, `SegmentedToggle`) so the
proposed sidebar can be browsed in Display Case itself before any chrome code is
written. Read alongside the proposal under
`openspec/changes/add-surface-information-architecture/`.

## The cases

- **Current** — today's single rail, grouped only by Atomic-Design level. Pages
  flatten into one alphabetical list, so authors prefix names (`Billing — …`)
  just to make the sort cluster related screens. This is the problem.
- **Exhibits mode** — the proposal's headline: the mode switch
  (**Primer · Components · Exhibits**) on the Exhibits view — pages + flows
  grouped by product information architecture, with a filter and a breadcrumb.
- **Components mode** — the other mode: the kit, grouped by level exactly as
  today. One grouping logic per view, never interleaved. The filter lives here
  too (a match in Exhibits stays reachable).
- **Nested groups** — the IA tree nesting to depth (`App › Settings › Billing`),
  shown filtered to "billing".
- **Two regions (alt)** — the rejected alternative: both axes stacked in one rail
  (Surfaces over Library). Kept as a documented fallback in `design.md`.

## Why it's only a mockup

`NavItem`/`Sidebar`/`SegmentedToggle` are static here with no-op handlers; group
folders, the filter, the breadcrumb, and the mode switch are arranged by hand,
not driven by the manifest. The real change wires these to a resolved `group`
axis on each page/flow and a `'primer' | 'components' | 'exhibits'` mode (see the
proposal's `design.md`).

**Layout note:** because the `/render` endpoint is chrome-free (no
header/aside/main grid), these mocks stack the mode switch and breadcrumb above
the rail. In the real chrome the **mode switch stays pinned in the left nav**
(where the Primer/Cases switch is today) and the **breadcrumb sits in the stage
header** — neither moves navigation into the main area.

Delete this folder once the change lands.
