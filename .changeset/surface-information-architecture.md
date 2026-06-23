---
"@awarebydefault/display-case": minor
---

Add page & flow information architecture. The catalog is now browsed in two
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
A `nav-groups-resolve` structure check warns when `nav` config names a group no
surface resolves to. `level` is unchanged and still drives the structure checks.
