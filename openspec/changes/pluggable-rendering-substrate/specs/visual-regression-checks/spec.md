## MODIFIED Requirements

### Requirement: Visual-regression checks

Display Case SHALL be able to capture each case's rendering — in the format the active substrate captures: an image under the default substrate, a textual frame under a substrate that serializes to text — and compare it against a previously recorded baseline for that case, reporting any case whose rendering differs beyond an allowed threshold. When no baseline exists for a case, the run SHALL be able to record one. A comparison run SHALL exit non-zero when any case differs from its baseline. The location where baselines are stored SHALL be configurable; absent configuration, a default location SHALL be used. Within that location, baselines SHALL be keyed by the active substrate and by the case's rendering-selecting variant values, and SHALL be stored in the substrate's declared format under the substrate's declared file extension — so switching substrates cannot silently reuse or invalidate another substrate's baselines, and a textual substrate's baselines are stored as reviewable text.

#### Scenario: A case differs from its baseline

- GIVEN a case that has a recorded visual baseline
- WHEN the case's rendering differs from the baseline beyond the threshold
- THEN the run reports that case as changed
- AND the run exits non-zero

#### Scenario: Recording a missing baseline

- GIVEN a case that has no recorded visual baseline
- WHEN the run is invoked in baseline-recording mode
- THEN a baseline is recorded for that case in the substrate's declared format

#### Scenario: All cases match their baselines

- GIVEN every case has a recorded baseline and matches it within the threshold
- WHEN a comparison run is performed
- THEN the run reports no changes and exits zero

#### Scenario: Configured baseline location

- GIVEN a configuration that sets the baseline storage location
- WHEN baselines are recorded
- THEN they are written to the configured location
- AND a comparison run reads baselines from that same location

#### Scenario: Baselines are keyed by substrate

- GIVEN baselines recorded under one substrate
- WHEN the showcase switches to a different substrate and records baselines
- THEN the new baselines are stored keyed to the new substrate
- AND the previous substrate's baselines are neither reused nor overwritten

#### Scenario: A textual substrate's baselines are reviewable text

- GIVEN a showcase whose substrate serializes frames to text
- WHEN a baseline is recorded and a later run differs from it
- THEN the baseline is stored as text under the substrate's declared extension
- AND the difference is reviewable as a readable text difference rather than an opaque binary

### Requirement: Configurable snapshot pipeline

The mechanism that captures a case's rendering and audits its accessibility, and the mechanism that compares two captured renderings, SHALL each be overridable through configuration. When a consumer supplies a custom mechanism, the checks SHALL use it; when none is supplied, the checks SHALL use the active substrate's default mechanisms — and under the default substrate those SHALL produce the same results as today. A consumer-supplied mechanism SHALL take precedence over the substrate's default.

#### Scenario: Custom capture mechanism

- GIVEN a configuration that supplies a custom capture/audit mechanism
- WHEN the checks run
- THEN that mechanism is used to render and audit each case
- AND the substrate's default is not invoked

#### Scenario: Custom comparison mechanism

- GIVEN a configuration that supplies a custom comparison mechanism
- WHEN the visual check runs
- THEN that mechanism decides whether each case differs from its baseline

#### Scenario: Provider receives the case identity

- GIVEN a configuration that supplies a custom mechanism
- WHEN the checks run a given case under given variant values
- THEN the mechanism is given that case's identity: component, case, and its rendering-selecting variant values (under the default substrate, its theme), together with the capture width where the substrate has one
- AND a mechanism that ignores the identity still works unchanged

#### Scenario: Substrate default when unconfigured

- GIVEN a configuration that supplies no custom mechanisms
- WHEN the checks run
- THEN the active substrate's default capture/audit and comparison are used
- AND under the default substrate they produce the same results as today
