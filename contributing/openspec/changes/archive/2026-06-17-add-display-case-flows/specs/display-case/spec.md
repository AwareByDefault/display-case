## ADDED Requirements

### Requirement: Interactive flow steps

An interactive flow is a showcased entry at the flow hierarchy level that comprises ordered, named steps, each demonstrating one state of a behavioural page or user flow. Each step SHALL render a variant with the preset state declared for that step, so that one presentational variant can serve several steps without duplication. Display Case SHALL render one step at a time in the preview area, SHALL let a viewer move between the steps of a flow from the browsing surface, SHALL make each step individually addressable so it can be deep-linked, and SHALL provide each step's isolated rendering free of the browsing chrome so it can be snapshotted on its own. Interaction within a rendered step SHALL behave as it would in the real flow.

#### Scenario: Selecting an interactive flow

- GIVEN an interactive flow that declares ordered, named steps
- WHEN a viewer selects the flow
- THEN its first step renders in the preview area as the active step
- AND each step renders with the preset state declared for it

#### Scenario: Moving between steps from the browsing surface

- GIVEN an interactive flow with multiple steps
- WHEN a viewer selects a different step from the browsing surface
- THEN that step renders as the active step
- AND the viewer can return to a previously viewed step

#### Scenario: Deep-linking to a flow step

- GIVEN an interactive flow with multiple steps
- WHEN a viewer opens the address of a specific step
- THEN that step renders directly as the active step of the flow

#### Scenario: Address for a missing step

- GIVEN an address that names a flow step that does not exist
- WHEN a viewer opens it
- THEN a not-found state is shown rather than an arbitrary or blank step

#### Scenario: Snapshotting a single flow step

- GIVEN an interactive flow with multiple steps
- WHEN a client requests the isolated rendering of one of its steps for a given theme
- THEN it receives only that step's content styled for that theme
- AND none of the browsing chrome is present in the result

### Requirement: Flow transitions

A flow step MAY declare transitions to other named steps of the same flow, and MAY designate interactions within its rendered content that fire those transitions. When a designated interaction is performed, Display Case SHALL make the transition's target step the active step. Activating a step through a transition SHALL update the active step in place without reloading the browsing surface, and the resulting active step SHALL be reproducible from its own address. A static page sequence — a flow whose steps declare no transitions — SHALL be valid and SHALL behave as ordered steps a viewer walks from the browsing surface.

#### Scenario: Advancing the flow from within a step

- GIVEN a flow step whose rendered content has an interaction designated to fire a transition to a named target step
- WHEN a viewer performs that interaction
- THEN the target step becomes the active step
- AND the active step changes in place without reloading the browsing surface

#### Scenario: A transitioned-to step is addressable

- GIVEN a viewer has advanced to a later step by performing an in-step transition
- WHEN the viewer opens that step's address directly afterwards
- THEN the same step renders as the active step
- AND it reflects the preset state declared for it

#### Scenario: A step with no transitions

- GIVEN a flow whose steps declare no transitions
- WHEN a viewer views one of its steps
- THEN it renders normally
- AND no transition can be fired from it, without error

## MODIFIED Requirements

### Requirement: Design-hierarchy classification

A case file MAY declare the showcased component's level in the design hierarchy. The supported levels, in order of increasing composition, SHALL be: atom, molecule, organism, template, page, and flow. Display Case SHALL group components by their declared level and SHALL present the groups in that order. A component whose level is not declared SHALL appear in a distinct unclassified group ordered last.

#### Scenario: Components grouped by level

- GIVEN case files that declare different hierarchy levels
- WHEN a viewer opens the browsing surface
- THEN components are grouped by level
- AND the groups appear in order from atom through flow

#### Scenario: Undeclared level

- GIVEN a case file that declares no hierarchy level
- WHEN a viewer opens the browsing surface
- THEN that component appears in an unclassified group ordered after the named levels

### Requirement: Machine-readable catalog

Display Case SHALL expose a machine-readable catalog that acts as a directory of every discovered component and case. For each component the catalog SHALL include its declared hierarchy level and file references — at least the case file and the authored usage documentation when present — by path rather than inlined content, so the catalog stays an index. For each case the catalog SHALL include its stable address and the tweak schema it declares; for a flow, each step SHALL be listed with its own address together with the step's outgoing transitions, each naming its target step. The catalog SHALL be retrievable without rendering the browsing surface.

#### Scenario: An AI agent enumerates components

- GIVEN Display Case is running
- WHEN a machine client requests the catalog
- THEN it receives a structured listing of every component and its cases
- AND each component entry includes its hierarchy level
- AND each case entry includes its stable address and its declared tweak schema
- AND each flow lists its steps with their individual addresses and each step's outgoing transitions
- AND each component entry references its case file and its usage documentation by path when present
- AND the catalog does not inline the contents of those files

## REMOVED Requirements

### Requirement: Prototype multi-page flows

**Reason**: Superseded by the interactive flow construct. The flow construct covers everything the static prototype did — ordered, individually addressable, snapshottable pages a viewer walks — and adds preset step state and in-step transitions. Two near-identical constructs at the same hierarchy level are removed in favour of one.

**Migration**: Express a former prototype as a flow whose steps declare no transitions; each former page becomes a step. Viewer-driven stepping, per-step deep-linking, and per-step snapshotting are preserved under "Interactive flow steps". The hierarchy level formerly named "prototype" is now named "flow".
