## ADDED Requirements

### Requirement: Proposed changes are gated by the full quality suite

The repository SHALL automatically run its full quality suite — static analysis,
type checking, the project's own static checks, unit tests, and end-to-end tests
— against every proposed change to the mainline, without a contributor having to
trigger it manually.

The suite SHALL run the verification (non-mutating) form of each layer, reporting
a failure on material that is unformatted, unlinted, mistyped, or failing a check
or test, rather than altering the proposed change to make it pass.

#### Scenario: A change is proposed

- GIVEN a contributor opens a proposed change against the mainline
- WHEN the change is created or updated with new revisions
- THEN the full quality suite runs automatically against the change's content
- AND no manual step is required to start it

#### Scenario: A layer detects a problem

- GIVEN the quality suite runs against a proposed change
- WHEN any layer — static analysis, type checking, a project static check, a unit
  test, or an end-to-end test — fails
- THEN the change is reported as failing its quality gate
- AND the suite does not modify the proposed change to mask the failure

#### Scenario: The suite passes

- GIVEN a proposed change whose content satisfies every layer
- WHEN the quality suite completes
- THEN the change is reported as passing its quality gate

### Requirement: Each verification layer is an independent signal

The quality suite SHALL report each verification layer as a separate, independent
result, so a failure identifies which layer failed without inspecting combined
output. The browser-dependent end-to-end layer SHALL be separable from the
browser-free layers so the latter are not blocked on provisioning a browser.

#### Scenario: One layer fails

- GIVEN the quality suite runs all of its layers
- WHEN exactly one layer fails and the others pass
- THEN the failing layer is reported as failed and the passing layers as passed
- AND the result identifies which layer failed

### Requirement: Superseded runs are cancelled

The repository SHALL cancel an in-progress quality-suite run when the proposed
change it is verifying receives a newer revision, so resources are not spent
verifying outdated content.

#### Scenario: A new revision arrives mid-run

- GIVEN the quality suite is running against a revision of a proposed change
- WHEN a newer revision of the same change is pushed before the run finishes
- THEN the in-progress run for the superseded revision is cancelled
- AND the suite runs against the newer revision instead
