## ADDED Requirements

### Requirement: Agent integration scaffolding

Display Case SHALL provide a command that installs its AI-agent integration into a target repository. Installation SHALL register Display Case as a launchable service in the target's agent launch configuration, place the bundled agent skills where the target agent loads skills from, and add a pointer to Display Case's agent guide in the target's agent instructions. The command SHALL report what it created, updated, or skipped; the report SHALL be human-readable by default and SHALL be available in a machine-readable form on request.

#### Scenario: First-time install

- GIVEN a repository with no Display Case agent integration
- WHEN the install command is run against it
- THEN a launchable Display Case service is registered in the agent launch configuration
- AND the bundled agent skills are placed where the agent loads skills
- AND a pointer to the agent guide is added to the agent instructions
- AND the command reports each artifact it created

#### Scenario: Reported actions

- GIVEN the install command runs
- WHEN it finishes
- THEN it reports, per artifact, whether it was created, updated, or skipped

#### Scenario: Machine-readable report on request

- GIVEN the install command is asked for machine-readable output
- WHEN it finishes
- THEN it emits the per-artifact actions in a structured, machine-parsable form
- AND without that request the report is human-readable

### Requirement: Idempotent, non-destructive scaffolding

Running the install command more than once SHALL be safe. It SHALL NOT duplicate entries it has already added, SHALL NOT overwrite unrelated configuration the operator has authored, and SHALL preserve existing launch entries and files not owned by Display Case.

#### Scenario: Re-running the install

- GIVEN a repository where Display Case agent integration is already installed
- WHEN the install command is run again
- THEN no duplicate launch entries or skill copies are created
- AND the command reports the already-present artifacts as skipped or updated, not added

#### Scenario: Preserving existing configuration

- GIVEN an agent launch configuration that already contains unrelated entries
- WHEN the install command merges its own entry
- THEN the unrelated entries are preserved unchanged

### Requirement: Pluggable agent target

The install command SHALL support selecting the target agent, SHALL support at least one agent target, and SHALL apply that target's conventions for where launch configuration, skills, and instructions live. When asked for an unsupported agent, it SHALL fail with a clear message rather than writing to an unknown location.

#### Scenario: Default agent target

- GIVEN no agent target is specified
- WHEN the install command runs
- THEN it installs for the default supported agent

#### Scenario: Unsupported agent target

- GIVEN an agent target the command does not support
- WHEN the install command is run for that target
- THEN it fails with a message naming the unsupported target
- AND it writes nothing

### Requirement: Removal of agent integration

Display Case SHALL provide a command that reverses the integration its install command added: it SHALL remove the Display Case launch entry, the bundled skills it installed, and the agent-guide pointer. It SHALL remove **only** artifacts owned by Display Case, leaving operator-authored launch entries, skills, and instructions untouched. Removal SHALL be idempotent — running it when nothing is installed, or running it twice, SHALL make no further changes — and SHALL report what it removed or skipped.

#### Scenario: Removing an installed integration

- GIVEN a repository where Display Case agent integration is installed
- WHEN the uninstall command is run
- THEN the Display Case launch entry, the bundled skills it installed, and the agent-guide pointer are removed
- AND the command reports each artifact it removed

#### Scenario: Owned-only removal

- GIVEN a launch configuration and skills directory that also contain operator-authored entries
- WHEN the uninstall command runs
- THEN the operator-authored entries and skills are preserved unchanged

#### Scenario: Uninstall when nothing is installed

- GIVEN a repository with no Display Case agent integration
- WHEN the uninstall command is run
- THEN nothing is changed
- AND the command reports that there was nothing to remove

### Requirement: Bundled agent skills

Display Case SHALL ship reusable agent skills as part of the package, and the install command SHALL install them. The skills SHALL at minimum cover: capturing a component's rendered appearance, authoring a missing case for an uncovered component, and reviewing accessibility and visual-regression findings.

#### Scenario: Skills are installed

- GIVEN the install command runs for a supported agent
- WHEN it completes
- THEN the bundled skills are present where the agent loads skills
- AND they include skills for snapshotting a component, authoring a missing case, and reviewing checks
