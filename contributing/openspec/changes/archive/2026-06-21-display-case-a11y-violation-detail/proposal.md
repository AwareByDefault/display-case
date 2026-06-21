## Why

Display Case's accessibility gate reports each violation as a rule, a
description, a severity, and an **affected-node count** — but not *which* node,
or *why* it failed. For the dominant finding (colour-contrast) that means the
report says "1 node failed color-contrast" without the failing element, the
foreground/background colours, the measured ratio, or the threshold it missed.

In practice this is not enough to fix anything: a recent pass over Display
Case's own library had to drive Playwright + axe directly to recover the exact
colour pairs and elements before the violations could be resolved. The data the
audit already computes is being discarded on the way out. This change keeps it —
in the gate's output and in a persisted result a person or agent can read later
without re-running the browser — so a finding is actionable on first read.

## What Changes

- **Per-node detail in the gate.** Each reported violation additionally carries,
  for each affected node and where the audit mechanism provides it, the affected
  element and — for a contrast violation — the foreground/background colours, the
  measured contrast, and the contrast the element was required to meet. The gate
  prints this detail beneath each violation.
- **Persisted results.** The gate writes the full results of a run (every
  failing case with its per-node detail) to a location readable without
  re-running the checks, overwriting the prior run. A clean run leaves an empty
  result so the persisted file always reflects the latest state.
- **Surfacing unchanged.** The running in-app accessibility surface continues to
  show the per-variant verdict (rule, severity, node count); the richer per-node
  detail is reserved for the gate's output and the persisted results, so the
  panel stays calm.
- **Mechanism-neutral.** The detail is part of the shared violation contract;
  the built-in audit mechanism populates it, and a consumer-supplied mechanism
  MAY populate or omit it. When omitted, the gate prints the summary as before.

## Capabilities

### New Capabilities
<!-- none — this extends the existing display-case capability -->

### Modified Capabilities
- `display-case`: **Accessibility checks** — extended so each violation carries
  per-affected-node detail (the element and, for contrast, the measured vs
  required colours/ratio) where the audit mechanism provides it; the gate
  presents that detail and persists the full results of a run to a location
  readable without re-running the checks.

## Impact

- **Code**: `packages/display-case/` — the shared violation model (`src/index.ts`),
  the built-in audit mechanism (`src/providers/playwright-driver.ts`), and the
  gate (`src/check.ts`, which prints the detail and writes the persisted report
  under the existing `.display-case/a11y/` cache).
- **Consumers**: the machine-readable accessibility result shape gains an
  optional per-node `details` field (tooling-internal, additive). Existing
  consumers and custom audit mechanisms are unaffected — the field is optional
  and the in-app surface is unchanged.
- **Out of scope**: auto-fixing violations; surfacing the per-node detail in the
  in-app panel; scanning tweaked (non-default) variant states.
