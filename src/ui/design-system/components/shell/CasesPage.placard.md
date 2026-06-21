**Cases page** — the Cases (library) chrome browsing the mock manifest: the [Case template](./CaseTemplate.placard.md) poured full, with a live exhibit on the stage. The consolidated dogfood of everything the library view does.

Behaviour, by case — each shows how the stage adapts to *what it's browsing*:

- **Default** — browsing a schema-less case (Button → Variants): bare stage, no tweaks or docs panel.
- **With tweaks** — browsing a case that carries a tweak schema (Button → Playground): the docked Tweaks panel rides alongside, its controls at their defaults driving the staged button.
- **With docs** — the component has a placard-doc, so the Docs panel opens with real prose.
- **With tweaks and docs** — the fullest case: Tweaks panel and open Docs panel flanking the stage.
- **Page** — browsing a page-level component: the stage drops its grid, corner ticks, and padding (and the header's Grid button), and fills edge-to-edge.
- **Flow** — browsing a flow: the FlowNav stepper appears above the stage (one tab per step) and, like a page, fills edge-to-edge.

A static snapshot per variant (the nav/controls don't route here). The reading view is its own page — see [Primer page](./PrimerPage.placard.md).
