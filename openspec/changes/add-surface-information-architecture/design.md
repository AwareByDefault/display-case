## Context

Display Case sorts the entire catalog on one axis — the Atomic-Design `level`
(`atom → molecule → organism → template → page → flow`). `src/core/catalog.ts`
sorts components by level then name; `src/ui/shell-core.ts` (`GROUP_ORDER`,
`groupByLevel`, `LEVEL_LABEL`) renders one section per level in the sidebar. That
single axis is correct for the reusable kit but wrong for pages and flows: in a
real app there are many of them, they are not ordered by composition relative to
one another, and one flat `Pages`/`Flows` section forces authors to bake IA into
names just to make the alphabetical sort group related screens.

`level` is load-bearing beyond navigation: the structure checks
(`no-downward-dependency`, `composes-lower-level`, `level-fit`) read it, and
`defineFlow` pins flows at `level: 'flow'`. So `level` cannot be removed from
pages/flows — the IA grouping must be a *second, additive* axis.

A free-form `area` tag already exists, but it feeds only the client `decorator`
(which app chrome to wrap a case in). It is not a navigation concern and is
single-valued; the IA group is a navigation concern and is a *path*.

The browse chrome already has a mode switch — Primer ↔ Cases — owned by the
primer capability and rendered with `SegmentedToggle` (`shell-core.ts` `Mode =
'primer' | 'library'`). It already animates an arbitrary number of segments, so
adding a third costs no new control.

## Goals / Non-Goals

**Goals:**

- A nestable IA `group` axis for pages and flows, resolved with zero config from
  folder layout and overridable explicitly and via showcase config.
- Keep `level` and the kit's level-grouping exactly as today; no behavior change
  when no group is declared.
- One consistent grouping logic per browse view, so the kit's composition axis
  and the app's IA axis never appear interleaved in the same list.
- Surface the resolved group path in the manifest (machine-readable first) and as
  on-screen orientation.
- A filter so a large catalog is navigable without scrolling — in both views.

**Non-Goals:**

- Re-grouping the building-block kit by IA. The level axis stays its primary
  organization; `group` is ignored for kit components in v1.
- Changing case addressing. Browse/render URLs stay component/case-slug based;
  `group` is organization + discovery metadata, not part of the address.
- Replacing or merging the `area` tag.
- Replacing the Primer's own heading-based narrative grouping.

## Decisions

### 1. Two independent axes: `level` (composition) and `group` (IA)

Every component keeps its `level`. Pages and flows additionally carry a `group`
— an ordered **path** of segments. A page/flow is still *classified* by level
(for structure checks and the manifest) but is *organized* for browsing under its
IA group.

*Why a path, not a flat string?* Real IA nests (`App / Settings / Billing`). A
path lets the tree nest to arbitrary depth and lets config target a node
(`App/Settings`) without naming every leaf. *Alternative — flat tags:* rejected;
tags can't express the parent/child structure the tree needs.

*Why keep two axes instead of overloading `level`?* The composition checks need
level; navigation needs IA. Conflating them would either break the checks or
flatten the IA.

### 2. Group resolution order (first match wins)

1. **Explicit** — `group` on the case module (`defineCases(..., { group })` /
   `defineFlow(name, { group })`). Accepts `'App/Settings/Billing'` or
   `['App','Settings','Billing']`.
2. **Folder-derived** — the directory path of the case file relative to the
   matched discovery root, minus the filename. `app/(marketing)/pricing/
   Pricing.case.tsx` → `Marketing / Pricing`. Framework route-group segments
   wrapped in parentheses, and leading private/route markers, are
   normalized/stripped; segments are title-cased for display but matched
   case-insensitively for config.
3. **Config mapping** — `defineConfig({ nav })` MAY map a surface (by id/glob or
   by `area`) to a group, for showcases whose folders don't mirror the IA.
4. **Fallback** — anything still ungrouped lands in a single default
   catch-all group, which reproduces today's flat behavior.

Folder derivation is **on by default** — it is the zero-config win — and a `nav`
flag can disable it for showcases whose folders don't mirror the IA, leaving
explicit `group` / config mapping / fallback to do the work.

*Alternative — folder-only:* rejected; some repos colocate cases away from routes
and need an explicit hook. *Alternative — explicit-only:* rejected; it throws
away the IA the folder tree already encodes.

### 3. `group` is distinct from `area`

`group` = where a surface sits in the nav (IA). `area` = which decorator chrome
wraps it (rendering). They frequently coincide, so `nav` config MAY declare
"derive group from `area`" as a convenience, but they remain separate fields:
`area` is a single chrome selector, `group` is a tree path, and merging them
would couple rendering to navigation.

### 4. Config-level curation

`DisplayCaseConfig` gains an optional `nav` block:

- `groups.order` — explicit ordering of groups; unlisted groups fall after listed
  ones in a deterministic default order (discovery order, then name).
- `groups.labels` — override a derived segment's display label (e.g. `app` →
  "Signed-in app") without renaming folders.
- `groups.collapsed` — groups collapsed by default on first load.
- `surface` mapping — the optional id/glob/area → group rules from Decision 2.3.

A static check MAY warn when `order`/`labels`/`collapsed` names a group that no
surface resolves to (catches typos), at warning severity.

### 5. Manifest shape

- Each `ManifestComponent`/`CatalogComponent` gains `group: string[]` (the
  resolved path; `[]` for kit components and for the fallback group).
- `Manifest` gains a `groups` index — the ordered, nested group tree with display
  labels and default-collapsed flags — so an agent can read the IA without
  reconstructing it from per-component paths.
- `--print-manifest` and `/manifest.json` reflect both. Addresses are unchanged.

### 6. Three browse modes: Primer · Components · Exhibits (chosen)

Rather than stack both axes in one rail (see the alternative below), the catalog
is split into two sibling browse views, extending the existing mode switch to a
three-way control:

- **Primer** — the authored reading surface (unchanged; offered only when a
  primer exists).
- **Components** — the building-block kit (atom–template), grouped by level
  exactly as today.
- **Exhibits** — the pages and flows, grouped by the IA tree (nested,
  collapsible via the existing disclosure machinery and `expanded: Set<string>`).

*Why two modes over one rail.* Each view then has exactly **one** grouping logic;
the viewer is never asked to reconcile "the top nests by feature, the bottom by
atom-size" in a single scroll. It also maps the data model onto the UI directly
(level axis → Components, group axis → Exhibits) and gives a large IA the full
height of the rail. The mode switch already exists and is option-count agnostic,
so this adds no new control.

*Placement — the switch does not move.* The switch stays pinned at the top of the
nav rail, exactly where the Primer/Cases switch sits today (ShellView's
`<ModeSwitch>` inside `<Sidebar>`, above the scrolling nav body). Adding a third
segment changes nothing about its location; it does **not** move into the main
area. (The chrome-free `/render` wireframes stack it above the rail only because
that endpoint omits the header/aside/main grid.)

*Dynamic presence.* Each of the three modes is present **iff it has content**: a
primer is configured; at least one building-block component (atom–template)
exists; at least one page/flow exists. The switch offers exactly the present
modes — two or more → a switch; a single present mode → no switch. So a
surfaces-only package (pages/flows, no building-block component `*.case.tsx`)
omits the **Components** mode entirely; a kit-only package omits **Exhibits**;
no primer omits **Primer**. `shell-core.ts` `Mode` extends from
`'primer' | 'library'` to `'primer' | 'components' | 'exhibits'`; the `library`
mode id and its routes are renamed/split, with `/c/...` addresses preserved.

*Landing.* The `landing` config selects which mode `/` opens, generalized from
`'primer' | 'cases'` to **`'primer' | 'components' | 'exhibits'`**. It is honored
only when that mode is present; otherwise it falls back to the first present mode
in a fixed order (Primer → Components → Exhibits). The manifest carries the set
of present modes and the resolved landing mode so the chrome renders the switch
and initial view server-side.

*Routing — the mode is the route prefix.* The two catalog modes are deep-linked
by a per-mode case prefix rather than separate mode-landing routes: `/c/<comp>/
<case>` is a **Components** (kit) case and `/e/<comp>/<case>` is an **Exhibits**
(surface) case, so every case link carries its mode. `/primer` is unchanged; `/`
resolves to the landing mode; the chrome-free `/render/<comp>/<case>` stays
unified (mode-agnostic — it renders a case by id). `resolveMode` reads the path
prefix; `buildUrl` and each `ManifestCase.browseUrl` choose `/c/` vs `/e/` by the
component's level (`isSurfaceLevel`). Switching modes in the UI navigates to that
mode's first selection under the matching prefix.

*Naming.* **Components** (precise — it is what they are, and matches the docs)
and **Exhibits** (the assembled, visitor-facing screens — fits the museum/Vitrine
metaphor while staying immediately legible). Rejected: *Specimens · Exhibits*
(more in-metaphor but "Specimens" reads obtusely for UI parts) and *Collection ·
Displays* ("Displays" collides with the Primer's `<Display>` specimen wrapper and
would force a rename). Legibility beats cuteness.

### 7. Filter in both modes, results spill across modes

Both the Components and the Exhibits view carry a text filter that narrows the
listing to name/group substring matches. Matches that live in the *other* mode
are appended **below** the current mode's results, clearly labelled as the other
mode, so the viewer never loses the cross-reference the two-mode split would
otherwise cost — e.g. filtering in Exhibits still surfaces a Component it
composes, listed under the Exhibit hits and switching modes on select. When the
current mode has **no** matches but the other mode does, the current mode shows
an explicit "no matches in this mode" state above the other-mode results, rather
than appearing blank. The filter is a progressive client enhancement: the initial
render lists the full tree server-side and the filter never gates first paint or
addressing.

### 8. Breadcrumb in the stage header

In the Exhibits mode, the active surface's full group path is shown as a
persistent breadcrumb in the stage header (the main area, above the preview);
a surface in the default group shows none. This is independent of the nav switch
and does not affect it — the nav tree *also* encodes the path through its expanded
ancestors and highlighted row, so the breadcrumb is a redundant-but-explicit
orientation aid that keeps the path visible when the nav is collapsed or filtered.
It occupies only the controls row the stage header already has; it does not push
navigation into the main area.

## Alternatives Considered

### Two-region single rail (kept as a fallback)

The first iteration stacked both axes in one sidebar: a **Surfaces** region
(pages + flows by IA) above a **Library** region (kit by level), no extra mode.
*Pros:* everything visible at once; no mode switch; no cross-mode jump. *Cons:*
two grouping logics interleave in one scroll, which reads as inconsistent, and a
large IA crowds the kit out of view. Rejected as the primary design for those
reasons, but retained as a fallback if the three-mode switch proves too heavy in
practice — the underlying axes (Decisions 1–5) are identical, so only the
presentation (Decisions 6–8) differs and the model would not change.

## Risks / Trade-offs

- **Cross-mode context-switching** (an Exhibit composes Components in the other
  mode) → mitigated by the cross-mode filter (Decision 7) and unchanged
  deep-linking; the two audiences (building a component vs. designing a screen)
  are usually in distinct tasks anyway.
- **Folder derivation surprises** (route-group syntax, deep nesting, casing) →
  normalize parentheses/markers, title-case for display only, and always allow an
  explicit `group` or config override; document the derivation rules.
- **Mode id rename** (`library` → `components`/`exhibits`) touches routing and
  test-ids → keep `/c/...` and `/render/...` addresses stable; redirect or alias
  the old landing route; update `src/ui/test-ids.ts` in lockstep with e2e.
- **Empty-mode handling** → resolve the offered modes server-side from catalog
  contents so the switch never shows a mode that would render empty.

## Migration Plan

Additive and backward-compatible. No data migration: existing showcases with no
`group` and no `nav` config render unchanged (everything resolves to the fallback
group; the Exhibits mode shows pages/flows as one default group). Adoption is
incremental — colocate page/flow cases under route-shaped folders, add explicit
`group`, or add `nav` config. Rollback is config/metadata removal; the two-region
alternative remains available without model changes.

## Open Questions

None remaining — all resolved during review:

- **Folder derivation default** → on by default, disablable via `nav`
  (Decision 2).
- **Primer but no exhibits** → fall back to the two-way `Primer · Components`
  switch (Decision 6).
- **Cross-mode filter presentation** → other-mode matches listed below the
  current mode's results, with an explicit "no matches in this mode" state when
  only the other mode matches (Decision 7).
