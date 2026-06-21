# Flows

## Purpose

An interactive flow is a showcased entry at the flow hierarchy level comprising ordered, named steps, each demonstrating one state of a behavioural page or user flow, with optional transitions between steps.

## Requirements

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
