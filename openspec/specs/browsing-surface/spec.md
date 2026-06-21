# Browsing Surface

## Purpose

Display Case presents a calm browsing surface that lists discovered components, lets a viewer select and render a case in isolation, and gives every case a stable, deep-linkable address.

## Requirements

### Requirement: Component browsing surface

Display Case SHALL present a browsing surface that lists the discovered components grouped by hierarchy level, lets a viewer select a component and one of its cases, and renders the selected case in a dedicated preview area isolated from the browsing chrome.

#### Scenario: Selecting a case

- GIVEN the browsing surface listing discovered components
- WHEN a viewer selects a component and one of its cases
- THEN the selected case renders in the preview area
- AND the selection is reflected as the active case

#### Scenario: Empty catalog

- GIVEN no case files exist
- WHEN a viewer opens the browsing surface
- THEN a calm empty state explains that no cases were found
- AND the surface does not error

### Requirement: Stable case addressing

Each case SHALL be reachable at a stable address derived from its component and case name. Opening that address SHALL render that case directly, and the address SHALL remain valid across restarts as long as the case exists.

#### Scenario: Deep-linking to a case

- GIVEN a case that exists in the catalog
- WHEN a viewer opens the case's stable address
- THEN that case renders directly without further navigation

#### Scenario: Address for a missing case

- GIVEN an address that names a component or case that does not exist
- WHEN a viewer opens it
- THEN a not-found state is shown rather than an arbitrary or blank case
