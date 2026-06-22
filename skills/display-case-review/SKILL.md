---
name: display-case-review
description: >
  Run Display Case's accessibility, visual-regression, and design-token checks
  over the component showcase, then triage the findings and propose fixes. Use
  when asked to "review the components", "check accessibility / contrast", "run
  the display-case checks", or to verify the showcase after a UI change.
---

Run the Display Case `check` runner and turn its output into actionable fixes.

## Steps

1. **Run the checks**: `bun run display-case:check` (or `bunx @awarebydefault/display-case check <pkgDir>`). Phases:
   - **a11y** — axe, WCAG 2 A/AA, per case × theme.
   - **visual** — pixel-diff each case (light + dark) against recorded baselines.
   - **tokens** — design-token conformance.
   - Run one phase with a flag, e.g. `bunx @awarebydefault/display-case check <pkgDir> --a11y`.
2. **Triage each finding** by category:
   - **a11y** (`label`, `color-contrast`, `aria-*`, …): if the case renders a bare control, fix the *case* (add a label/`aria-label`); if the component itself fails (contrast tokens, missing accessible name), fix the *component*/tokens.
   - **visual** diffs: inspect the written `*.diff.png`; if the change is intended, re-record with `--update`; otherwise it's a regression to fix.
   - **tokens**: resolve the flagged custom property, or add it to the config `tokens.allow` if it's supplied by a host stylesheet.
3. **Fix at the right layer** — prefer fixing the component/tokens over weakening the check. Never silence a real finding.
4. **Re-run** until the relevant phase is clean (exit 0).

## Notes

- Visual baselines live in the gitignored `.display-case/baselines/` by default (or the configured `baselineDir`); `--update` re-records them.
- The runner drives the same `/render` endpoint a viewer sees, so findings reflect real appearance.
- Deeper detail: `../../docs/testing.md`.
