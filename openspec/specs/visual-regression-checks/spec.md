# Visual-Regression Checks

## Purpose

Display Case renders each case to an image and compares it against a recorded baseline, with an overridable capture/audit and comparison pipeline whose default backend is optional.

## Requirements

### Requirement: Visual-regression checks

Display Case SHALL be able to render each case to an image and compare it against a previously recorded baseline for that case, reporting any case whose rendering differs beyond an allowed threshold. When no baseline exists for a case, the run SHALL be able to record one. A comparison run SHALL exit non-zero when any case differs from its baseline. The location where baselines are stored SHALL be configurable; absent configuration, a default location SHALL be used.

#### Scenario: A case differs from its baseline

- GIVEN a case that has a recorded visual baseline
- WHEN the case's rendering differs from the baseline beyond the threshold
- THEN the run reports that case as changed
- AND the run exits non-zero

#### Scenario: Recording a missing baseline

- GIVEN a case that has no recorded visual baseline
- WHEN the run is invoked in baseline-recording mode
- THEN a baseline image is recorded for that case

#### Scenario: All cases match their baselines

- GIVEN every case has a recorded baseline and matches it within the threshold
- WHEN a comparison run is performed
- THEN the run reports no changes and exits zero

#### Scenario: Configured baseline location

- GIVEN a configuration that sets the baseline storage location
- WHEN baselines are recorded
- THEN they are written to the configured location
- AND a comparison run reads baselines from that same location

### Requirement: Configurable snapshot pipeline

The mechanism that captures a case's rendering and audits its accessibility, and the mechanism that compares two renderings, SHALL each be overridable through configuration. When a consumer supplies a custom mechanism, the checks SHALL use it; when none is supplied, the checks SHALL use a built-in default that produces the same results as today.

#### Scenario: Custom capture mechanism

- GIVEN a configuration that supplies a custom capture/audit mechanism
- WHEN the checks run
- THEN that mechanism is used to render and audit each case
- AND the built-in default is not invoked

#### Scenario: Custom comparison mechanism

- GIVEN a configuration that supplies a custom image-comparison mechanism
- WHEN the visual check runs
- THEN that mechanism decides whether each case differs from its baseline

#### Scenario: Provider receives the case identity

- GIVEN a configuration that supplies a custom mechanism
- WHEN the checks run a given case in a given theme
- THEN the mechanism is given that case's identity (component, case, theme, width)
- AND a mechanism that ignores the identity still works unchanged

#### Scenario: Default when unconfigured

- GIVEN a configuration that supplies no custom mechanisms
- WHEN the checks run
- THEN the built-in default capture/audit and comparison are used

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
