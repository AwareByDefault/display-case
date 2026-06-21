# display-case-review

Run Display Case's checks and triage the findings into fixes.

## What it does

Runs `display-case check` — accessibility (axe, WCAG A/AA), visual regression (pixel diff vs baselines), and design-token conformance — then classifies each finding (case-authoring vs component/token issue vs intended visual change) and proposes the fix at the right layer.

## When it triggers

"Review the components", "check accessibility/contrast", "run the display-case checks", or verifying the showcase after a UI change.

## How it works

1. `bun run display-case:check` (or a single phase via `--a11y` / `--visual` / `--tokens`).
2. Triage: fix the case when an example is malformed; fix the component/tokens when the component itself fails; re-record baselines with `--update` only for intended changes.
3. Re-run until clean. Never silence a real finding.

Details: [`../../docs/testing.md`](../../docs/testing.md).
