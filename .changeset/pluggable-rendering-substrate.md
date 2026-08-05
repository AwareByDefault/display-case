---
'@awarebydefault/display-case': minor
---

Make the renderer pluggable: a `substrate` config key selects what a case is rendered *into*.

Display Case's pipeline was substrate-neutral in intent but hard-wired to one medium: React → HTML → a hydrated browser document. The part that turns a case into something viewable is now a replaceable unit, so a showcase can target a medium that is not the DOM at all while keeping the browse chrome, tweaks, flows, manifest, checks, and publish pipeline unchanged.

Nothing changes for an existing showcase. With no `substrate` configured you get the built-in DOM substrate, which produces byte-identical documents (pinned by a golden test) and identical check results.

- **New `substrate` config key** — pass a substrate to render into another medium. The contract (`Substrate`, variant axes, stage document, stage runtime, check phases) ships from the new `@awarebydefault/display-case/core` subpath export, so a substrate is implementable out-of-tree without reaching into internals. Documented **experimental** until a second, non-DOM implementation has been built against it.
- **New `./core` export** — the substrate-neutral core: the authoring model, discovery, catalog, manifest, groups, and the DOM-free `caseTree()`. A module-graph test enforces that it reaches nothing in `server/`, `checks/`, `commands/`, or `ui/`.
- **New `display-case render <component>/<case>`** — print a case's serialized frame to stdout (`--variant=`, `--tweak=`, `--out=`). No server and no browser: for an agent this removes the HTTP round trip, and for a text-serializing substrate it produces something readable directly rather than an image.
- **Substrate-declared variant axes** — light/dark and pixel viewports are no longer hard-coded. The substrate declares its axes, split into `render` (encoded in the address, changes the rendering) and `stage` (adjusts presentation around an unchanged frame). The manifest now carries `substrate: { id, variants }` so an agent enumerates a case's addressable variants instead of assuming light/dark. The DOM substrate declares today's theme and viewport axes with their existing ids and values.
- **`providers.driver` is deprecated** (still honored). A render driver opens and screenshots a URL in a browser — a property of the DOM substrate, not of Display Case — so it is now `domSubstrate({ driver })`. Existing configs keep working unchanged; `providers.diff` is not deprecated, as a comparison is substrate-neutral.

Also fixes a latent bug the change surfaced: a `browserOnly` case now skips tree *construction*, not just rendering. A case whose thunk touches `document` (reading the root theme to pick a provider mode, as Material UI's setup does) previously threw out of the render endpoint as a 500 instead of falling back to client rendering.
