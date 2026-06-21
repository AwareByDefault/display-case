## Why

The render-backed gating checks (accessibility and visual-regression) re-render
every case on every run. In CI on a pull request that is the bulk of the wall
time, and most of it is wasted: a pull request usually touches a handful of
components, so re-auditing the entire showcase tells you nothing new about the
other ninety-plus cases. We want a way to run these checks against only the
components a change could actually have affected, without ever silently skipping
a component a change *did* affect.

## What Changes

- Add a **change-scoping** mode to the gating checks: restrict the
  accessibility and visual-regression phases to a chosen subset of components.
- Two ways to choose the subset:
  - **Explicit** — name components (by id or glob).
  - **By change** — derive the subset from the files changed since a base
    revision. A component is in scope when a changed file lies in its **import
    closure** (the case, the component, and everything they import transitively,
    including stylesheets).
- **Soundness rule for change-derived scope:**
  - A changed file that **no** component's closure claims — a globally-inlined
    stylesheet, the render pipeline, shared source — scopes to **every**
    component (a regression is never silently skipped).
  - A change touching **no** render input (docs, specs, tests, tooling) scopes
    to **nothing** and the render phases pass without launching a browser.
- The static phases (structure, tokens, server-render) are unaffected — they are
  already cheap and file-oriented.
- Scoping is **opt-in**; with neither selector the checks run over every
  component exactly as before.

## Capabilities

### New Capabilities
- `change-scoped-checks`: selecting which components the gating render checks run
  against — explicitly, or derived from the files a change touched via their
  import closure — with a conservative fallback that treats an unattributable
  render-input change as affecting every component.

### Modified Capabilities
<!-- none — accessibility-checks and visual-regression-checks keep their behavior;
     this capability governs only which components they are pointed at. -->

## Impact

- **New code**: an import-closure analysis (`src/core/affected.ts`) and the
  change/explicit scope resolution in the check runner (`src/checks/check.ts`).
- **CLI**: `display-case check` gains `--only=<ids/globs>` and `--changed[=ref]`
  (base ref also via `DISPLAY_CASE_BASE_REF`).
- **Consumes**: the CI workflow (`add-pr-ci-workflow`) uses `--changed` to gate
  PRs on a11y + visual only for affected components.
- **No runtime impact** on a published showcase or a consuming application.
