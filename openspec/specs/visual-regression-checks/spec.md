# Visual-Regression Checks

## Purpose

Display Case renders each case to an image and compares it against a recorded baseline, with an overridable capture/audit and comparison pipeline whose default backend is optional.
## Requirements
### Requirement: Visual-regression checks

Display Case SHALL be able to capture each case's rendering — in the format the active substrate captures: an image under the default substrate, a textual frame under a substrate that serializes to text — and compare it against a previously recorded baseline for that case, reporting any case whose rendering differs beyond an allowed threshold. When no baseline exists for a case, the run SHALL be able to record one. A comparison run SHALL exit non-zero when any case differs from its baseline. The location where baselines are stored SHALL be configurable; absent configuration, a default location SHALL be used. Within that location, baselines SHALL be keyed by the active substrate and by the case's rendering-selecting variant values, and SHALL be stored in the format the substrate captures, under that format's file extension — so switching substrates cannot silently reuse or invalidate another substrate's baselines, and a textual substrate's baselines are stored as reviewable text.

#### Scenario: A case differs from its baseline

- GIVEN a case that has a recorded visual baseline
- WHEN the case's rendering differs from the baseline beyond the threshold
- THEN the run reports that case as changed
- AND the run exits non-zero

#### Scenario: Recording a missing baseline

- GIVEN a case that has no recorded visual baseline
- WHEN the run is invoked in baseline-recording mode
- THEN a baseline is recorded for that case in the format the substrate captures

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
- THEN the baseline is stored as text under that format's extension
- AND the difference is reviewable as a readable text difference rather than an opaque binary

### Requirement: Configurable snapshot pipeline

The mechanism that captures a case's rendering and audits its accessibility is supplied by the active substrate, which opens a variant once for both phases to read (see Rendering Substrate). The mechanism that compares two captured renderings SHALL be overridable through configuration: when a consumer supplies one the visual check SHALL use it, and when none is supplied the check SHALL use the active substrate's default — which under the default substrate SHALL produce the same results as today. A consumer-supplied comparison SHALL take precedence over the substrate's default.

#### Scenario: Custom capture mechanism

- GIVEN a configuration that supplies a custom capture/audit mechanism
- WHEN the checks run
- THEN that mechanism is used to render and audit each case
- AND the built-in default is not invoked

#### Scenario: Substrate-supplied capture and audit

- GIVEN a showcase whose substrate opens variants its own way
- AND no custom capture mechanism is configured
- WHEN the checks run
- THEN that substrate renders and audits each case
- AND the default substrate's browser capture is not invoked

#### Scenario: Custom comparison mechanism

- GIVEN a configuration that supplies a custom comparison mechanism
- WHEN the visual check runs
- THEN that mechanism decides whether each case differs from its baseline

#### Scenario: Provider receives the case identity

- GIVEN a configuration that supplies a custom mechanism
- WHEN the checks run a given case under given variant values
- THEN the mechanism is given that case's identity: component, case, and its rendering-selecting variant values (under the default substrate, its theme), together with the capture width where the substrate has one
- AND a mechanism that ignores the identity still works unchanged

#### Scenario: Default when unconfigured

- GIVEN a configuration that supplies no custom mechanisms
- WHEN the checks run
- THEN the active substrate's default capture/audit and comparison are used
- AND under the default substrate they produce the same results as today

### Requirement: Optional default backend

The packages the built-in default depends on SHALL be optional. They SHALL be loaded only when the default mechanism is actually used. When a check needs the built-in default but its packages are not available, the run SHALL fail with a message that states what is missing and how to resolve it (install the default toolchain, or supply a custom mechanism); it SHALL NOT fail merely for browsing, snapshotting via the render endpoint, or running checks with custom mechanisms supplied.

#### Scenario: Default backend missing

- GIVEN no custom mechanisms are configured
- AND the default backend's packages are not installed
- WHEN a check that needs the default is run
- THEN the run fails with a message naming what is missing and how to resolve it

#### Scenario: Custom mechanisms avoid the default backend

- GIVEN custom capture and comparison mechanisms are configured
- AND the default backend's packages are not installed
- WHEN the checks run
- THEN they complete using the custom mechanisms without requiring the default packages

### Requirement: Capture reflects the requested theme in the color-scheme preference

Display Case SHALL, when it renders a case for capture or audit under a requested
theme, present the rendering environment's user-agent color-scheme preference as
matching that theme. As a result, a showcased component that detects the theme
*only* through the user agent's color-scheme preference — the one signal a served
page cannot set for itself — SHALL be captured and audited in the requested theme
rather than in the capture environment's default, for every theme a case is
captured or audited under.

#### Scenario: A preference-only component is captured in the requested theme

- GIVEN a showcased component that detects light versus dark only through the user agent's color-scheme preference
- WHEN Display Case renders that case for capture under the dark theme
- THEN the rendering environment reports the user-agent color-scheme preference as dark
- AND the captured image shows the component in its dark appearance

#### Scenario: Each captured theme reports its matching preference

- GIVEN a case captured under both the light and dark themes
- WHEN each capture is taken
- THEN the light capture reports the user-agent color-scheme preference as light
- AND the dark capture reports it as dark

