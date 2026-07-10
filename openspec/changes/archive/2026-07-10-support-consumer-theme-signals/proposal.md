## Why

Display Case expresses the preview theme on the document root as a `data-theme`
attribute plus the CSS `color-scheme` property. That covers the showcase's own
tokens (which key off `[data-theme]`), the CSS-standard path (`color-scheme` is
what `light-dark()` reads), and consumers on DaisyUI or next-themes' default
config (which also read `data-theme`). But there is **no single cross-framework
standard** for how a component reads dark/light, so a large class of showcased
components does not follow Display Case's theme toggle at all.

A survey of current (2025–2026) practice found the theme signal split across
several mutually-incompatible root conventions:

- a **`.dark` class** on the root — Tailwind's class/selector mode, shadcn/ui,
  next-themes with `attribute="class"`, VueUse `useDark()` and Nuxt Color Mode
  defaults. The dominant convention in the React/Tailwind ecosystem.
- **`data-bs-theme`** — Bootstrap 5.3+.
- **`data-mui-color-scheme`** — Material UI's CSS-variables mode (its default).
- **`@media (prefers-color-scheme)`** — the OS/user-agent setting, which a
  normally-served page cannot override from CSS or JS (setting `color-scheme` does
  not flip it); only test-tool media emulation can.

So a component that reads a `.dark` class, `data-bs-theme`, or
`data-mui-color-scheme` stays in its default theme regardless of the toggle,
undermining the core promise that a component can be browsed and snapshotted in
either theme without booting an app. The gap surfaced while fixing Display Case's
own dogfooded chrome (which reads `data-theme`) and was confirmed by researching
how each framework detects dark mode.

## What Changes

- **Display Case drives a configurable set of theme root signals** on the document
  root — beyond its own always-present `data-theme` + `color-scheme` — so showcased
  components reading any common convention follow the preview theme. The default
  set adds the `.dark` class convention (the largest ecosystem); Bootstrap, Material
  UI, and arbitrary custom attribute/class mappings are opt-in. Because the signals
  sit on the root, nested components **inherit** them.
- **The signal set is applied identically before scripting and across an
  interactive theme switch.** Every delivered document (isolated render, browsing
  surface, primer) already carries the configured signals for the requested theme,
  and the in-place toggle re-applies the same set — no flash, no restyle out of
  sync, matching today's `data-theme`/`color-scheme` behavior.
- **The configuration is declarative, serializable data — not an executable
  adapter.** Unlike the `providers` toolchain (a server-only function), a theme
  applier runs in both the delivered document and the live client, so the option is
  a serializable description of which signals to emit (named conventions plus custom
  attribute/class mappings) that resolves identically on both sides.
- **The snapshot/audit toolchain additionally emulates `prefers-color-scheme`** to
  match the rendered theme, so a component that themes *only* through the media
  query is still captured and audited in the correct theme — the one signal the
  interactive and inherited paths cannot reach.
- **No case-authoring change; zero-config behavior is a strict superset.** Existing
  consumers keep `data-theme` + `color-scheme`; the added default `.dark` class is
  inert for components that don't read it.

Explicitly **out of scope:** making a bare `@media (prefers-color-scheme)`
component follow the *interactive* toggle on a normally-served page — a platform
limitation (the media feature reflects the OS setting and cannot be forced by a
served page), not something Display Case can implement.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities

- `theming-and-viewport`: the theme control SHALL drive a configurable set of
  document-root signals (default `data-theme` + `color-scheme` + a dark class;
  opt-in Bootstrap, Material UI, and custom attribute/class mappings), so showcased
  components reading any of those conventions — directly or by inheritance — reflect
  the chosen theme, applied without reloading the catalog.
- `server-rendering`: the themed document delivered before scripting SHALL carry
  the configured theme signals for the requested theme, so a component reading any
  of them presents in the requested theme without executing scripts, and the set
  SHALL stay matched across an interactive theme change.
- `visual-regression-checks`: the capture/audit toolchain SHALL emulate the
  user-agent color-scheme preference to match the rendered theme, so a component
  that themes only through `@media (prefers-color-scheme)` is captured and audited
  in the correct theme.

## Impact

- **Affected code:**
  - A shared, pure resolver (new — in the render layer) mapping a `Theme` + the
    configured signal set to a description of root attributes, classes, and
    `color-scheme`, consumed by both the server string builders and the client
    appliers so the two never drift.
  - Server string baking: `src/render/documents.ts` (`shellDoc`/`renderDoc`/
    `primerDoc`) and `src/server/server.ts` (shell, isolated render, build-error,
    primer templates).
  - Client application: `src/ui/render-mount.tsx` (`applyDocEffects`),
    `src/ui/use-shell.ts` (theme effect), `src/ui/primer-mount.tsx`,
    `src/ui/primer.tsx` (postMessage theme handler), and the per-specimen
    `<Display>` forced-theme wrapper.
  - Config plumbing: a new `theme` field on `DisplayCaseConfig` (`src/index.ts`);
    the resolved signal set serialized into a dedicated `window.__dcThemeSignals`
    inline (in every document — `src/server/server.ts` / `src/render/documents.ts`),
    read by `readThemeSignals()` in the client appliers so they re-emit it on toggle.
  - Check toolchain: `src/checks/providers/playwright-driver.ts` (emulate
    `prefers-color-scheme` per rendered theme); shared by visual and a11y checks.
- **Public API / authoring:** additive only — a new optional `theme` config option;
  no case-authoring change; addresses, the manifest, and the published-build
  contract are unchanged. The `./prod-server` document output gains the configured
  signals via the shared `documents.ts` renderers.
- **Visual baselines:** the default signal set does not change Display Case's own
  chrome (it reads `data-theme`), so the repo's baselines are unaffected. A consumer
  that enables extra signals for components that visibly re-theme on them will need
  to (re)record those cases' baselines.
