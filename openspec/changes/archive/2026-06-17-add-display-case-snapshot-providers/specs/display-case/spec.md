## ADDED Requirements

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

### Requirement: Optional visual-regression setup during install

The agent-integration install command SHALL be able to set up the default visual-regression toolchain — the optional packages and the browser they require. This setup SHALL be opt-in: requested explicitly for non-interactive use, or offered as a choice when run interactively. Declining SHALL leave the repository unchanged with respect to that toolchain.

#### Scenario: Opting in to visual-regression setup

- GIVEN the install command is asked to set up visual-regression checking
- WHEN it runs
- THEN the default visual-regression toolchain and its browser are installed

#### Scenario: Declining visual-regression setup

- GIVEN the install command is run without requesting visual-regression setup
- WHEN it completes
- THEN the visual-regression toolchain is not installed
- AND the rest of the integration is still scaffolded
