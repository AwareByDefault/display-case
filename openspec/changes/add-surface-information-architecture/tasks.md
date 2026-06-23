## 1. Authoring API

- [x] 1.1 Add an optional `group` to `CaseMeta` and to `defineFlow`'s config in `src/index.ts`, accepting a path string (`'App/Settings'`) or segment array (`['App','Settings']`); normalize to `string[]`. Leave `area` unchanged.
- [x] 1.2 Add an optional `nav` block to `DisplayCaseConfig`: `groups.order`, `groups.labels`, `groups.collapsed`, and the surface→group mapping (by id/glob and/or by `area`). Export the new types; confirm existing `defineCases`/`defineFlow`/`defineConfig` call sites stay source-compatible (additive only).

## 2. Group resolution & model

- [x] 2.1 Implement group resolution in `src/core/` with first-match-wins order: explicit `meta.group` → folder-derived from `sourcePath` relative to the matched discovery root → config mapping → default fallback group.
- [x] 2.2 Implement folder derivation (on by default; disablable via `nav`): strip the filename, normalize framework route-group/private segments (e.g. `(marketing)`), title-case segments for display while matching case-insensitively for config; coalesce the same normalized path from different sources into one group.
- [x] 2.3 Restrict the IA group axis to page- and flow-level components; building-block levels ignore `group` and keep level grouping.
- [x] 2.4 Unit-test resolution precedence, folder derivation (incl. route-group syntax and nesting), and fallback.

## 3. Catalog & manifest

- [x] 3.1 Add `group: string[]` to `CatalogComponent`/`ManifestComponent` (the resolved path; `[]` for kit and fallback).
- [x] 3.2 Build the overall group index (ordered, nested tree with display labels and default-collapsed flags) into the `Manifest`, honoring `nav.groups.order`/`labels`/`collapsed` with a deterministic default order for unlisted groups.
- [x] 3.3 Confirm `--print-manifest` and `/manifest.json` expose per-component group paths and the group index without rendering the browsing surface; addresses unchanged.

## 4. Browse modes (chrome)

- [x] 4.1 Extend the mode model in `src/ui/shell-core.ts` from `Mode = 'primer' | 'library'` to `'primer' | 'components' | 'exhibits'`; resolve the *present* modes server-side from catalog contents (primer configured; ≥1 building-block component; ≥1 page/flow) so an empty mode is never offered — including omitting Components for a surfaces-only catalog and Exhibits for a kit-only one. Show a switch only when ≥2 modes are present.
- [x] 4.7 Generalize the landing config in `src/index.ts` from `'primer' | 'cases'` to `'primer' | 'components' | 'exhibits'`; carry the present-modes set and the resolved landing mode on the `Manifest` (replacing `landing: 'primer' | 'library'` and the boolean `primer` gate), honoring the configured landing only when present and otherwise falling back in order primer → components → exhibits. Update `buildManifest` and all `Manifest` consumers.
- [x] 4.2 Extend the mode switch (`SegmentedToggle`) to render the present modes (Primer · Components · Exhibits) with labels; route the modes by case-path prefix — `/c/<comp>/<case>` for Components, `/e/<comp>/<case>` for Exhibits, `/primer` unchanged, `/` → landing mode; keep `/render/<comp>/<case>` unified (mode-agnostic). `resolveMode` reads the prefix; `buildUrl` and each `ManifestCase.browseUrl` pick `/c/` vs `/e/` by `isSurfaceLevel(level)`.
- [x] 4.3 Components mode: keep the level grouping (`groupByLevel`) exactly as today.
- [x] 4.4 Exhibits mode: render the nested, collapsible IA groups for surfaces (reuse the disclosure/`expanded` machinery); keep leaf labels short (rely on existing ellipsis truncation); show the active surface's group path as a breadcrumb in the stage header.
- [x] 4.5 Add a text filter to both modes that narrows by name/group and restores on clear; append cross-mode matches below the current mode's results (labelled, selecting one switches mode), and show an explicit "no matches in this mode" state when the current mode is empty but the other has hits; keep it a progressive enhancement that does not change the initial SSR listing or addressing.
- [x] 4.6 Update `src/ui/test-ids.ts`: extend `modeSwitch` to the new modes and add ids for the filter input, group rows, and breadcrumb.

## 5. Checks

- [ ] 5.1 Add a static check (structure phase) that reports `nav` config naming a group no surface resolves to, at warning severity; make it independently disablable.
- [x] 5.2 Confirm the existing structure checks (composition, level) are unaffected — they continue to read `level`, which pages/flows retain.

## 6. Verification against spec

- [x] 6.1 Verify the mode switch offers Primer · Components · Exhibits, omits any empty mode, and that switching lists the kit by level (Components) and surfaces by IA (Exhibits).
- [x] 6.2 Verify resolution precedence end-to-end (explicit overrides folder; folder overrides config-less; config assigns when neither; fallback otherwise) and that an ungrouped surface lands in the default group and still appears.
- [x] 6.3 Verify the filter narrows and restores each mode, reaches cross-mode matches, and does not affect deep-linking; verify the breadcrumb shows the active surface's group path.
- [ ] 6.4 Verify `nav.groups.order`/`labels`/`collapsed` are honored and that an unknown group reference warns without failing the run.
- [x] 6.5 Verify a showcase with no `group` and no `nav` config presents the Exhibits mode as a single default group (no regression vs. today's listing), and `/c/...` addresses are unchanged.
- [x] 6.6 Add e2e coverage (`e2e/`) for the three-way mode switch, nested group expand/collapse, filtering (incl. cross-mode), and the breadcrumb using the new test-ids.

## 7. Docs & post-change review

- [ ] 7.1 Document the Components/Exhibits browse modes, the IA `group` axis, resolution order, folder derivation, and the `group`-vs-`area` distinction in `docs/configuration.md`, `docs/writing-cases.md`, `docs/hierarchy.md`, and `display-case.prompt.md`.
- [ ] 7.2 Post-change review per CLAUDE.md: update `contributing/coding-best-practices.md`, `contributing/NOTES.md`, and `README.md` where the modes/IA axis introduce something a future contributor must know.
- [ ] 7.3 Add a changeset (`bun run changeset`) declaring the release impact (minor — additive API + behavior).
