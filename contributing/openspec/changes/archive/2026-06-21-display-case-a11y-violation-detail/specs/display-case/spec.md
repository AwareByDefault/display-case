## MODIFIED Requirements

### Requirement: Accessibility checks

Display Case SHALL be able to run automated accessibility checks against the
rendered cases and report violations per case. The checks SHALL be runnable
without the interactive browsing surface, and SHALL exit non-zero when any case
has a violation so the run can gate other processes. Each reported violation
SHALL carry its severity in addition to its rule, description, and affected-node
count. For each affected node, where the audit mechanism provides it, the
violation SHALL additionally carry the affected element and — for a contrast
violation — the foreground and background colours, the measured contrast, and
the contrast the element was required to meet, so a finding is actionable
without re-running the checks. The gating run SHALL present this per-node detail
in its output, and SHALL persist the full results of the run to a location
readable without re-running the checks, reflecting the most recent run. The
gating run SHALL run when invoked regardless of whether in-app accessibility
surfacing is configured, and SHALL evaluate cases using the same scan parameters
(such as which themes are scanned and which rules are excluded) that the in-app
surface uses, so the two agree on what counts as a violation.

#### Scenario: A case with an accessibility violation

- GIVEN a case whose rendered output has an accessibility violation
- WHEN the accessibility checks are run
- THEN the violation is reported attributed to that case
- AND the run exits non-zero

#### Scenario: All cases pass accessibility checks

- GIVEN every case renders without accessibility violations
- WHEN the accessibility checks are run
- THEN the run reports success and exits zero

#### Scenario: Reported violations carry severity

- GIVEN a case whose rendered output has an accessibility violation
- WHEN the accessibility checks are run
- THEN the reported violation includes its severity

#### Scenario: Contrast violation carries the measured colours

- GIVEN a case whose rendered output has a colour-contrast violation
- AND the audit mechanism provides per-node detail
- WHEN the accessibility checks are run
- THEN the reported violation includes the affected element, its foreground and background colours, the measured contrast, and the contrast it was required to meet

#### Scenario: Results persisted for later reading

- GIVEN the accessibility checks have been run
- WHEN the persisted results are read without running the checks again
- THEN they list each failing case with its per-node detail
- AND they reflect the most recent run

#### Scenario: Gate runs independently of the in-app opt-in

- GIVEN in-app accessibility surfacing is not configured
- WHEN the accessibility checks are run
- THEN the checks still evaluate every case and gate on the result
