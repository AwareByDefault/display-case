# Structure Checks

Display Case runs a set of static best-practice checks over a showcase — inspecting authored material and configuration without rendering any case or starting a browser — covering coverage, hierarchy, primer, snapshot setup, addressing, tweaks, flow integrity, and composition, with configurable phases, severities, and per-target exemptions.

## Requirements

### Requirement: Structure best-practice checks

Display Case SHALL be able to run a set of static best-practice checks over a showcase — checks that inspect the showcase's authored material and configuration without rendering any case and without a browser. Each check SHALL report every finding attributed to the file or case responsible. The checks SHALL be runnable on their own, SHALL be able to run as part of the combined check run, and SHALL exit non-zero when any error-severity finding is produced so the run can gate other processes. Each individual best-practice rule SHALL be independently disablable through configuration; a disabled rule SHALL contribute no findings.

#### Scenario: Running the structure checks alone

- GIVEN a showcase configuration
- WHEN the structure best-practice checks are run on their own
- THEN they complete without rendering any case or starting a browser
- AND each violation is reported attributed to the file or case responsible

#### Scenario: An error-severity finding gates the run

- GIVEN a showcase with at least one error-severity structure finding
- WHEN the structure checks are run
- THEN the findings are reported
- AND the run exits non-zero

#### Scenario: A clean showcase passes

- GIVEN a showcase with no error-severity structure findings
- WHEN the structure checks are run
- THEN the run reports success and exits zero

#### Scenario: Disabling a rule

- GIVEN a configuration that disables a specific best-practice rule
- WHEN the structure checks are run
- THEN that rule contributes no violations
- AND the remaining rules still run

### Requirement: Case and usage-documentation coverage

The structure checks SHALL verify that every component the showcase declares as showcasable has both a colocated case and colocated usage documentation. A showcasable component missing its case, its usage documentation, or both SHALL be reported, identifying the component and what is missing. A component explicitly exempted from this rule SHALL NOT be reported.

#### Scenario: Component missing its usage documentation

- GIVEN a showcasable component that has a case but no colocated usage documentation
- WHEN the coverage check runs
- THEN the component is reported as missing its usage documentation

#### Scenario: Component missing its case

- GIVEN a showcasable component that has no colocated case
- WHEN the coverage check runs
- THEN the component is reported as missing its case

#### Scenario: Fully covered component

- GIVEN a showcasable component that has both a colocated case and colocated usage documentation
- WHEN the coverage check runs
- THEN the component produces no violation

#### Scenario: Exempted component

- GIVEN a showcasable component explicitly exempted from the coverage rule
- WHEN the coverage check runs
- THEN the component produces no violation

### Requirement: No orphaned usage documentation

The structure checks SHALL verify that every authored usage-documentation file has a colocated case. Usage documentation with no colocated case SHALL be reported as orphaned. The presence of a component source module SHALL NOT be required for usage documentation to be considered non-orphaned — a colocated case is sufficient.

#### Scenario: Orphaned usage documentation

- GIVEN usage documentation with no colocated case
- WHEN the orphan check runs
- THEN the usage documentation is reported as orphaned

#### Scenario: Documentation with a colocated case

- GIVEN usage documentation that has a colocated case but no component source module
- WHEN the orphan check runs
- THEN the usage documentation produces no violation

### Requirement: Declared hierarchy level

The structure checks SHALL verify that every discovered case declares a hierarchy level among the named levels. A case whose component is left unclassified SHALL be reported. A case explicitly exempted from this rule SHALL NOT be reported.

#### Scenario: Unclassified component

- GIVEN a discovered case whose component declares no hierarchy level
- WHEN the level check runs
- THEN the case is reported as unclassified

#### Scenario: Classified component

- GIVEN a discovered case whose component declares one of the named hierarchy levels
- WHEN the level check runs
- THEN the case produces no violation

#### Scenario: Exempted case

- GIVEN a discovered case explicitly exempted from the level rule
- WHEN the level check runs
- THEN the case produces no violation

### Requirement: Primer presence and use

When its rule is enabled, the structure checks SHALL verify that the showcase provides a primer that is configured, exists, embeds at least one live specimen using the specimen contract, and is not effectively empty. A primer that is unconfigured, absent, contentless, or that embeds no specimen using the specimen contract SHALL be reported. Disabling this rule SHALL suppress these reports, consistent with a primer being optional.

#### Scenario: No primer configured

- GIVEN a showcase that configures no primer
- AND the primer rule is enabled
- WHEN the primer check runs
- THEN the showcase is reported as missing a primer

#### Scenario: Primer configured but empty

- GIVEN a showcase that configures a primer that exists but is effectively empty or embeds no specimen using the specimen contract
- WHEN the primer check runs
- THEN the primer is reported as present but unused

#### Scenario: Primer present and used

- GIVEN a showcase that configures a primer that exists, is non-trivial, and embeds at least one live specimen using the specimen contract
- WHEN the primer check runs
- THEN the primer produces no violation

#### Scenario: Primer rule disabled

- GIVEN a showcase that configures no primer
- AND the primer rule is disabled
- WHEN the structure checks run
- THEN no primer violation is reported

### Requirement: Snapshot setup present

The structure checks SHALL verify that the render-based checks can run — either a custom snapshot mechanism is configured or the default snapshot mechanism is available to the checks. The default mechanism SHALL count as available whether it is provided by the showcase itself or by the checks' own tooling, so that a showcase which obtains the toolchain indirectly is not reported as missing it. When neither a custom mechanism is configured nor the default is available from either source, the structure checks SHALL report that the snapshot setup is missing, identifying what is needed to resolve it. This verification SHALL NOT itself render a case or start a browser.

#### Scenario: Neither default nor custom snapshot mechanism available

- GIVEN a showcase that configures no custom snapshot mechanism
- AND the default snapshot mechanism is unavailable both to the showcase and to the checks' own tooling
- WHEN the setup check runs
- THEN it reports the snapshot setup as missing and how to resolve it
- AND it does not render a case or start a browser

#### Scenario: Custom snapshot mechanism configured

- GIVEN a showcase that configures a custom snapshot mechanism
- WHEN the setup check runs
- THEN it produces no violation even if the default mechanism is unavailable

#### Scenario: Default snapshot mechanism available to the showcase

- GIVEN a showcase that configures no custom snapshot mechanism
- AND the default snapshot mechanism is available to the showcase
- WHEN the setup check runs
- THEN it produces no violation

#### Scenario: Default snapshot mechanism available only through the checks' tooling

- GIVEN a showcase that configures no custom snapshot mechanism
- AND the default snapshot mechanism is not available to the showcase directly
- AND it is available to the checks' own tooling
- WHEN the setup check runs
- THEN it produces no violation

### Requirement: Per-target structure exemption

A specific file or case SHALL be exemptable from an individual structure rule. An exemption SHALL be expressible as a marker within the authored source that records a stated reason, and SHALL also be expressible as configured path patterns for that rule. An exempted target SHALL produce no violation for the rule it is exempted from while remaining subject to all other rules.

#### Scenario: In-source exemption marker

- GIVEN a file carrying an exemption marker for a specific rule with a stated reason
- WHEN that rule runs
- THEN the file produces no violation for that rule
- AND the file is still evaluated by the other rules

#### Scenario: Configured path exemption

- GIVEN a configuration that exempts a set of paths from a specific rule
- WHEN that rule runs
- THEN the matching paths produce no violation for that rule

### Requirement: Configurable default check phases

Each check phase SHALL be configurable as to whether it participates in the default check run — the run that names no specific phase. A phase opted out of the default run SHALL still be invocable by naming it explicitly, and naming a phase explicitly SHALL run it regardless of its default-run setting. Absent any such configuration, every phase SHALL participate in the default run.

#### Scenario: Phase opted out of the default run

- GIVEN a configuration that opts a phase out of the default run
- WHEN the check is run with no phase named
- THEN that phase does not run
- AND the other phases run

#### Scenario: Explicitly invoking an opted-out phase

- GIVEN a configuration that opts a phase out of the default run
- WHEN the check is run naming that phase explicitly
- THEN that phase runs

#### Scenario: Default run with no phase configuration

- GIVEN a configuration that does not restrict the default run
- WHEN the check is run with no phase named
- THEN every phase participates in the run

### Requirement: Finding severity

Every structure finding SHALL carry a severity of either warning or error. An error-severity finding SHALL cause the run to exit non-zero; a warning-severity finding SHALL be reported but SHALL NOT, by itself, cause a non-zero exit. Each rule SHALL have a default severity and SHALL allow that severity to be overridden through configuration. The structure checks SHALL provide a strict mode that treats every warning as an error for that run.

#### Scenario: Warnings do not fail the run

- GIVEN a showcase whose only structure findings are warnings
- WHEN the structure checks are run
- THEN the warnings are reported
- AND the run exits zero

#### Scenario: An error fails the run

- GIVEN a showcase with at least one error-severity finding
- WHEN the structure checks are run
- THEN the run exits non-zero

#### Scenario: Overriding a rule's severity

- GIVEN a configuration that sets a rule's severity to error
- AND that rule would otherwise warn
- WHEN the structure checks are run and that rule is violated
- THEN the finding is reported at error severity
- AND the run exits non-zero

#### Scenario: Strict mode escalates warnings

- GIVEN a showcase whose only structure findings are warnings
- WHEN the structure checks are run in strict mode
- THEN the warnings are treated as errors
- AND the run exits non-zero

### Requirement: Discovered cases load

The structure checks SHALL verify that every discovered case loads. A case that fails to load SHALL be reported as a violation identifying the offending file, so that a broken case gates the run rather than only being noted while building the catalog.

#### Scenario: A case fails to load

- GIVEN a discovered case that fails to load
- WHEN the structure checks run
- THEN the failure is reported attributed to that case
- AND the run exits non-zero

### Requirement: Referenced files exist

The structure checks SHALL verify that files the configuration references — at least the global style entries and the configured baseline location when set — exist. A configured reference that does not resolve to an existing file SHALL be reported.

#### Scenario: A configured file is missing

- GIVEN a configuration that references a file that does not exist
- WHEN the structure checks run
- THEN the missing reference is reported

### Requirement: Unique case addressing

The structure checks SHALL verify that no two components, and no two cases within a single component, resolve to the same stable address. A collision SHALL be reported, identifying the colliding entries.

#### Scenario: Two components collide on their address

- GIVEN two components whose names resolve to the same stable address
- WHEN the structure checks run
- THEN the collision is reported

#### Scenario: Two cases within a component collide

- GIVEN one component with two cases whose names resolve to the same stable address
- WHEN the structure checks run
- THEN the collision is reported

### Requirement: Valid choice-tweak defaults

The structure checks SHALL verify that every fixed-option (choice) tweak declares a default value that is one of its declared options. A choice tweak whose default is not among its options SHALL be reported.

#### Scenario: Choice default outside its options

- GIVEN a case with a fixed-option tweak whose default value is not one of its options
- WHEN the structure checks run
- THEN the invalid default is reported

#### Scenario: Choice default within its options

- GIVEN a case with a fixed-option tweak whose default value is one of its options
- WHEN the structure checks run
- THEN it produces no violation

### Requirement: Flow integrity

The structure checks SHALL verify two properties of every interactive flow: a flow SHALL comprise more than one step, and every transition a step declares SHALL name an existing step of the same flow. A flow with a single step SHALL be reported, and a transition naming a step that does not exist SHALL be reported.

#### Scenario: A single-step flow

- GIVEN an interactive flow that declares only one step
- WHEN the structure checks run
- THEN the flow is reported as having too few steps

#### Scenario: A transition to a non-existent step

- GIVEN a flow step that declares a transition to a step that does not exist in the same flow
- WHEN the structure checks run
- THEN the dangling transition is reported

#### Scenario: A well-formed flow

- GIVEN an interactive flow with more than one step whose every transition names an existing step
- WHEN the structure checks run
- THEN it produces no violation

### Requirement: Composition direction

When their rules are enabled, the structure checks SHALL verify that composition flows up the hierarchy. A component SHALL NOT depend on another showcased component declared at a strictly higher level of composition, and a component at the lowest (atom) level SHALL NOT depend on any other showcased component. A violating dependency SHALL be reported, identifying the depending component. These rules SHALL be disabled by default and enabled through configuration. A dependency on something that cannot be resolved to a showcased component SHALL NOT, by itself, constitute a violation.

#### Scenario: An atom depends on another showcased component

- GIVEN the atom-purity rule is enabled
- AND a component at the atom level that depends on another showcased component
- WHEN the structure checks run
- THEN the dependency is reported

#### Scenario: A component depends on a higher-level component

- GIVEN the no-downward-dependency rule is enabled
- AND a component that depends on a showcased component of a strictly higher level
- WHEN the structure checks run
- THEN the inverted dependency is reported

#### Scenario: A same-level dependency is allowed

- GIVEN the no-downward-dependency rule is enabled
- AND a component that depends only on showcased components of the same or a lower level
- WHEN the structure checks run
- THEN it produces no violation

#### Scenario: Composition rules off by default

- GIVEN a configuration that does not enable the composition rules
- WHEN the structure checks run
- THEN no composition violation is reported

#### Scenario: An unresolved dependency is not an error

- GIVEN a composition rule is enabled
- AND a component whose dependency cannot be resolved to a showcased component
- WHEN the structure checks run
- THEN that dependency alone produces no error-severity finding

#### Scenario: An unresolved but probably-showcased dependency warns

- GIVEN a composition rule is enabled
- AND a component that depends on another showcase in the same workspace through a form the resolver cannot follow
- WHEN the structure checks run
- THEN the unresolved dependency is reported as a warning identifying what could not be resolved
- AND it does not by itself fail the run

### Requirement: Lower-level composition

When its rule is enabled, the structure checks SHALL verify that every component above the atom level depends on at least one showcased component of a lower level. A qualifying component that composes nothing from a lower level SHALL be reported. This rule SHALL be disabled by default. A dependency on a showcased component provided by another showcase available in the same workspace SHALL count toward this requirement, resolved to that other showcase's declared level.

#### Scenario: A non-atom composes nothing lower

- GIVEN the lower-level-composition rule is enabled
- AND a component above the atom level that depends on no showcased component of a lower level
- WHEN the structure checks run
- THEN the component is reported

#### Scenario: Composition satisfied across showcases

- GIVEN the lower-level-composition rule is enabled
- AND a component above the atom level that depends on a lower-level showcased component provided by another showcase in the same workspace
- WHEN the structure checks run
- THEN the cross-showcase dependency satisfies the requirement
- AND the component produces no violation

#### Scenario: An organism composed only of atoms is valid

- GIVEN the lower-level-composition rule is enabled
- AND an organism-level component that depends only on atom-level showcased components
- WHEN the structure checks run
- THEN the requirement is satisfied by the atom-level dependencies
- AND the component produces no finding

#### Scenario: Lower-level-composition off by default

- GIVEN a configuration that does not enable the lower-level-composition rule
- WHEN the structure checks run
- THEN no lower-level-composition finding is reported

### Requirement: Level-fit advisory

The structure checks SHALL offer an advisory rule that flags a component composing more lower-level showcased components than recommended for its level, as a hint that it may belong at a higher level. The recommended threshold per level SHALL be configurable. This rule SHALL be disabled by default, and when enabled SHALL default to warning severity so that, absent an explicit override, it does not by itself fail the run.

#### Scenario: A component exceeds its level's threshold

- GIVEN the level-fit rule is enabled with a threshold for a level
- AND a component at that level that composes more lower-level showcased components than the threshold
- WHEN the structure checks run
- THEN the component is flagged as a candidate for a higher level
- AND, at the default severity, the finding does not by itself fail the run

#### Scenario: Level-fit off by default

- GIVEN a configuration that does not enable the level-fit rule
- WHEN the structure checks run
- THEN no level-fit finding is reported
