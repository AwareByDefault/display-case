## ADDED Requirements

### Requirement: In-app accessibility surfacing

When accessibility surfacing is configured, Display Case SHALL present each
variant's accessibility result on the running browsing surface: a per-variant
marker in the navigation and a verdict beside the rendered variant. When
accessibility surfacing is NOT configured, the browsing surface SHALL be
unchanged — no markers and no verdict surface.

Results SHALL be produced on demand for the variant being viewed, SHALL be
reused without re-scanning while nothing affecting that variant's rendered
output has changed, and SHALL never block the browsing surface or the rendering
of a variant. A variant whose result is not yet available SHALL read as in
progress until it lands. A variant SHALL be evaluated per theme, and the verdict
SHALL reflect the theme currently shown.

When accessibility surfacing is configured but its scanning prerequisite is
unavailable, Display Case SHALL still start and browse normally and SHALL
indicate the surface is unavailable rather than reporting a false result.

#### Scenario: Surfacing not configured

- **WHEN** Display Case runs without accessibility surfacing configured
- **THEN** the browsing surface shows no accessibility markers and no verdict surface

#### Scenario: Viewing a variant with violations

- **GIVEN** accessibility surfacing is configured
- **WHEN** a variant whose rendered output has accessibility violations is viewed
- **THEN** its violations are presented beside the rendered variant
- **AND** the navigation marks that variant as having violations

#### Scenario: Viewing a clean variant

- **GIVEN** accessibility surfacing is configured
- **WHEN** a variant whose rendered output has no accessibility violations is viewed
- **THEN** the verdict reports the variant passes
- **AND** the navigation shows no violation marker for that variant

#### Scenario: Result not yet available

- **GIVEN** accessibility surfacing is configured
- **WHEN** a variant is viewed before its result is available
- **THEN** the verdict reads as in progress without blocking the rendered variant
- **AND** the verdict updates in place once the result lands

#### Scenario: Per-theme verdict

- **GIVEN** a variant that has violations in one theme but not another
- **WHEN** the shown theme is changed
- **THEN** the verdict reflects the accessibility result for the shown theme

#### Scenario: Scanning prerequisite unavailable

- **GIVEN** accessibility surfacing is configured
- **AND** the scanning prerequisite is unavailable
- **WHEN** Display Case is started and a variant is viewed
- **THEN** Display Case browses normally
- **AND** the surface indicates accessibility results are unavailable rather than reporting a pass or failure

## MODIFIED Requirements

### Requirement: Accessibility checks

Display Case SHALL be able to run automated accessibility checks against the
rendered cases and report violations per case. The checks SHALL be runnable
without the interactive browsing surface, and SHALL exit non-zero when any case
has a violation so the run can gate other processes. Each reported violation
SHALL carry its severity in addition to its rule, description, and affected-node
count. The gating run SHALL run when invoked regardless of whether in-app
accessibility surfacing is configured, and SHALL evaluate cases using the same
scan parameters (such as which themes are scanned and which rules are excluded)
that the in-app surface uses, so the two agree on what counts as a violation.

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

#### Scenario: Gate runs independently of the in-app opt-in

- GIVEN in-app accessibility surfacing is not configured
- WHEN the accessibility checks are run
- THEN the checks still evaluate every case and gate on the result

### Requirement: Live authoring updates

Display Case SHALL reflect edits to the material it presents while running,
without requiring the viewer to manually restart the tool — whether the edit
adds or changes a case, a component's usage documentation, placard content, or a
component's own implementation. The current selection SHALL be preserved across
such an update where it still exists. When a change affects a variant's rendered
output and accessibility surfacing is configured, that variant's accessibility
result SHALL be re-evaluated to reflect the change.

#### Scenario: Editing a case while running

- GIVEN Display Case is running and a case is selected
- WHEN the author changes that case's definition
- THEN the rendered case reflects the change without a manual restart
- AND the case remains the active selection

#### Scenario: Adding a case while running

- GIVEN Display Case is running
- WHEN the author adds a new case file colocated with a component
- THEN the new case appears in the catalog without a manual restart

#### Scenario: Editing a component implementation while running

- GIVEN Display Case is running and a case for a component is selected
- WHEN the author changes that component's implementation source
- THEN the rendered case reflects the change without a manual restart
- AND the case remains the active selection

#### Scenario: Accessibility re-evaluated after an edit

- GIVEN Display Case is running with accessibility surfacing configured and a case selected
- WHEN an edit changes that case's rendered output
- THEN that case's accessibility result is re-evaluated and the surfaced verdict updates
