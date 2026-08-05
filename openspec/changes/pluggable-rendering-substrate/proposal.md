# Pluggable Rendering Substrate

> GitHub issue: [#42 — Pluggable rendering substrate](https://github.com/AwareByDefault/display-case/issues/42)

## Why

Display Case's pipeline — discovery, manifest, chrome, tweaks, flows, checks,
publish — is substrate-neutral in intent, but the renderer is hard-wired to one
substrate: the DOM (`react-dom` + a browser bundle). That blocks an entire class
of consumer: React renderers that never produce HTML, such as
[Carte](https://github.com/AwareByDefault/carte), our concurrent React renderer
for terminals, whose components render to a cell grid and ANSI bytes. The seam
already exists — the case tree construction is DOM-free and the chrome talks to
the stage only through an embedded document and a message protocol — so making
the substrate replaceable is a refactor along existing lines, not a rebuild.

## What Changes

- Introduce a **substrate** concept: the part of the pipeline that turns a case
  tree into something viewable becomes a configurable unit selected in the
  showcase configuration, defaulting to the current DOM behavior so existing
  consumers see no change.
- The substrate owns headless frame production (render without a browser),
  frame serialization, the **entire stage document** the chrome embeds, and an
  optional client-side stage runtime that paints/hydrates the frame.
- **Variant axes generalize**: light/dark theme and pixel viewport presets stop
  being hard-coded and become axes the substrate declares (the DOM substrate
  declares theme + viewport; a terminal substrate declares e.g. cols×rows and
  color capability). Render addresses, the manifest, baselines, and the chrome
  controls follow the declared axes.
- **Check phases delegate through the substrate**: render safety (today "ssr"),
  accessibility audit, visual capture/diff, and token conformance become
  substrate-supplied, with the DOM substrate providing today's exact behavior
  (react-dom render, axe, screenshot + pixel diff, CSS custom properties).
- **Visual baselines become substrate-keyed** on disk with a
  substrate-determined file extension, so text-frame baselines are reviewable
  diffs and switching substrates cannot silently invalidate baselines.
- Expose the substrate-neutral core (authoring API, discovery, catalog,
  manifest, case-tree construction) as a **stable public entry point** so a
  substrate can be implemented out-of-tree without reaching into internals.
- Add a CLI **render subcommand** that prints a case's serialized frame to
  stdout — for text substrates this drops the server and browser out of the
  agent loop entirely.
- The existing snapshot-provider surface splits: capture moves into the
  substrate, the diff function stays independently overridable, and the
  browser-driver override is demoted to a DOM-substrate option (accepted as a
  deprecated alias — public API does not break).
- **Non-goals**: the browsing chrome stays a DOM application; no Carte
  dependency ships from this package (the Carte substrate lives out-of-tree);
  no multi-substrate showcases in one package; `Bun.serve`/Bun bundling stay.

## Capabilities

### New Capabilities

- `rendering-substrate`: the substrate contract — configuration-selected, with
  the DOM substrate as the default; headless frame rendering and serialization;
  ownership of the stage document behind a stable embed contract (render
  address shape + stage message protocol); substrate-declared variant axes;
  substrate-delegated check phases (safety, audit, capture, diff, token
  conformance); the stable substrate-implementor entry point; the CLI frame
  render subcommand.

### Modified Capabilities

- `theming-and-viewport`: theme and viewport stop being hard-coded axes; they
  become the DOM substrate's declared variant axes, and the chrome's variant
  controls render whatever axes the active substrate declares.
- `render-endpoint`: the chrome-free render address serves the substrate's
  stage document; the theme query parameter generalizes to substrate-declared
  variant parameters (theme remains valid for the DOM substrate).
- `server-rendering`: the pre-script guarantee is restated substrate-neutrally
  — the frame is fully computed server-side and delivered in the document; the
  ssr safety check generalizes to "renders headlessly without throwing",
  delegated to the substrate; the browser-only escape hatch generalizes to a
  substrate-keyed concept.
- `visual-regression-checks`: capture goes through the substrate (no server or
  browser required when the substrate captures headlessly); baselines become
  substrate-keyed with substrate-determined extensions and variant-axis keys;
  the substrate supplies the default diff; the existing provider overrides
  remain as explicit consumer-level overrides.
- `accessibility-checks`: the audit is delegated to the substrate; the DOM
  substrate keeps today's axe behavior; a substrate may declare the phase
  inapplicable.
- `discovery-and-manifest`: the manifest carries the active substrate's
  identity and declared variant axes so agents can enumerate variants without
  assuming light/dark.
- `browsing-surface`: the stage embed contract — today implicit — is pinned:
  the chrome embeds the stage by render address and communicates only over the
  stage message protocol, regardless of substrate.
- `hierarchy`: the level taxonomy stays fixed; a substrate may supply display
  labels for levels (e.g. "Screens" for "Pages").
- `publishing`: the published build bundles the substrate's stage runtime; a
  substrate can declare shared modules merged into the consumer's share list;
  the always-shared React runtime becomes substrate-declared; static export
  ships precomputed frames with no dev machinery.

## Impact

- **Affected code**: the render layer (server-side rendering, documents, style
  collection, theme signals), the dev/prod servers and per-case bundling, the
  stage mount/hydration entries, all check phases except structure, the
  publish pipeline, the chrome's variant controls and shared route/URL logic,
  the package export map, and the e2e suite's theme/viewport locators.
- **Public API**: additions only — a `substrate` config key (defaulting to the
  DOM substrate), a new substrate-implementor entry point, and a CLI render
  subcommand. The snapshot-provider driver override is deprecated but still
  accepted. Existing showcases run unchanged with identical output.
- **Dependencies**: none added. The DOM substrate wraps the existing
  `react-dom`/Playwright/axe/pixelmatch toolchain, still lazily loaded.
- **Out of scope**: the Carte substrate itself (built out-of-tree against the
  new contract); interactive non-DOM cases beyond static frames (v1 of a
  non-DOM stage runtime may paint static frames per tweak/variant combination);
  an ANSI→HTML pre-paint for terminal frames.
