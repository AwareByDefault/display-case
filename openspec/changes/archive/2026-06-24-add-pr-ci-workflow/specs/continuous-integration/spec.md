## ADDED Requirements

### Requirement: Proposed changes are gated by the full quality suite

The repository SHALL automatically run its full quality suite — static analysis,
type checking, the project's own static checks, unit tests, end-to-end tests, and
the gating render checks (accessibility and visual-regression) — against every
proposed change to the mainline, without a contributor having to trigger it
manually. The render checks MAY be scoped to the components a change affects (see
the change-scoped-checks capability).

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

### Requirement: Integration is blocked while a change carries an open proposal

The repository SHALL block a proposed change from integrating into the mainline
while that change carries an open, unarchived change proposal, until the proposal
is archived. A change MAY keep an open proposal during review; the only proposal
material it may integrate is archived proposals and the canonical specification
updates that archiving produces. Removing an open proposal SHALL be permitted,
since that is how archiving moves it out of the active set.

#### Scenario: A change would integrate an open proposal

- GIVEN a proposed change whose content adds or modifies an open, unarchived proposal
- WHEN the quality suite runs against the change
- THEN the change is reported as failing its quality gate
- AND it cannot integrate until the proposal is archived

#### Scenario: A change archives a proposal

- GIVEN a proposed change that removes an open proposal and adds its archived form together with the canonical specification updates
- WHEN the quality suite runs against the change
- THEN the proposal-hygiene gate reports the change as passing
