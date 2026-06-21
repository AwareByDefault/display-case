## Why

Display Case can already run accessibility checks, but only as a one-shot
command that prints to a log and gates CI. The results never reach the person
browsing components, so violations stay invisible during the work that creates
them. A real scan of Display Case's own library found **101 violations across
its cases** (color-contrast dominating, plus form-control naming issues that are
genuine bugs), confirming there is real signal to surface. This change brings
those results into the running browse surface — discoverable in the nav and
readable beside the rendered case — and makes the surface update as components
change, so the feedback loop is immediate instead of after-the-fact.

The surfacing UI is already prototyped (per-variant nav markers, an
Accessibility panel with pending / clean / violations states). What's missing is
the behavior that feeds it real data and keeps it fresh, done in a way that
stays optional (the scanning prerequisite is not an assumed dependency), cheap
(scan only what's viewed, cache the rest), and non-blocking (the app never waits
on a scan).

## What Changes

- **In-app accessibility surfacing (opt-in).** When accessibility scanning is
  configured, Display Case surfaces each variant's result on the browsing
  surface: a per-variant marker in the navigation and a verdict panel beside the
  rendered case (in progress / clean / violations). When it is **not**
  configured, the surface is unchanged — no markers, no panel.
- **Scanning is on-demand, cached, and non-blocking.** The result for the viewed
  variant is produced lazily, reused from a persisted cache when still valid, and
  never blocks the browsing surface or its rendering. A variant whose result is
  not yet available reads as "in progress" until it lands.
- **Per-theme results.** A variant is scanned per theme and the panel reflects
  the theme currently shown (the real scan found theme-specific violations).
- **Richer violation detail.** Each reported violation carries its severity
  (impact) in addition to its rule, description, and affected-node count, so
  results can be ordered by seriousness. **BREAKING** (tooling-internal): the
  machine-readable accessibility result shape gains a severity field.
- **Graceful degradation.** Enabling scanning when its prerequisite is
  unavailable surfaces an unobtrusive "unavailable" state rather than failing to
  start the tool.
- **Live updates extend to component sources.** Editing a component's
  implementation (not only its case/doc/placard material) updates the rendered
  case in place, and re-evaluates that case's accessibility result.
- **CI gate stays independent.** The command-line accessibility check used for
  gating runs when invoked regardless of the in-app opt-in, while sharing the
  same scan parameters (themes, rule exclusions) so the panel and the gate agree
  on what counts as a violation.
- **Run modes clarified (direction-setting).** The interactive run becomes the
  default experience, leaving room for a future static, host-able build as the
  opposite pole (out of scope here; noted so the surfacing/caching design slots
  into it).

## Capabilities

### New Capabilities
<!-- none — this extends the existing display-case capability -->

### Modified Capabilities
- `display-case`: **Accessibility checks** — extended so results can be surfaced
  on the running browse surface (opt-in, per-variant, per-theme, with in-progress
  / clean / violation states), produced on demand and cached, never blocking the
  surface, degrading gracefully when the scan prerequisite is unavailable, and
  carrying per-violation severity; the command-line gate stays independent of the
  in-app opt-in while sharing scan parameters.
- `display-case`: **Live authoring updates** — extended so edits to a component's
  implementation source (not only authored case/doc/placard material) are
  reflected in the rendered case without a manual restart, and trigger
  re-evaluation of that case's accessibility result.

## Impact

- **Code**: `packages/display-case/` — config schema (`defineConfig` /
  `DisplayCaseConfig`), the browse server + file watcher (`server.ts`), the
  accessibility runner/driver (`check.ts`, `providers/playwright-driver.ts`), the
  live state hook (`use-shell.ts`), and the already-built surfacing UI
  (`ShellView.tsx`, `NavItem.tsx`, `chrome.css`). New cache under
  `.display-case/a11y/`.
- **Dependencies**: the headless-browser + accessibility-audit toolchain
  (Playwright + axe-core) remains an optional, lazily-loaded prerequisite — not
  added to the assumed install footprint.
- **Consumers**: Display Case consumers opt in via `display-case.config.ts`; the
  default experience is unchanged unless configured. The machine-readable
  accessibility result shape gains a severity field (tooling-internal).
- **Out of scope**: the static host-able build mode; auto-fixing violations;
  scanning tweaked (non-default) variant states.
