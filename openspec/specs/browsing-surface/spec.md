# Browsing Surface

## Purpose

Display Case presents a calm browsing surface that lists discovered components, lets a viewer select and render a case in isolation, and gives every case a stable, deep-linkable address.
## Requirements
### Requirement: Component browsing surface

Display Case SHALL present a browsing surface that lists the discovered components, lets a viewer select a component and one of its cases, and renders the selected case in a dedicated preview area isolated from the browsing chrome. The catalog SHALL be presented as two browse modes that a viewer can switch between: a Components mode listing the building-block components (atom through template) grouped by hierarchy level, and an Exhibits mode listing the page and flow surfaces organized by their information-architecture group (see Information Architecture). A browse mode that would contain no components SHALL NOT be offered.

#### Scenario: Selecting a case

- GIVEN the browsing surface listing discovered components
- WHEN a viewer selects a component and one of its cases
- THEN the selected case renders in the preview area
- AND the selection is reflected as the active case

#### Scenario: Switching between Components and Exhibits

- GIVEN a showcase containing both building-block components and page/flow surfaces
- WHEN a viewer switches to the Components mode
- THEN the building-block components are listed grouped by hierarchy level
- AND when the viewer switches to the Exhibits mode the page and flow surfaces are listed organized by their information-architecture group

#### Scenario: A mode with no content is not offered

- GIVEN a showcase that declares building-block components but no page or flow surfaces
- WHEN a viewer opens the browsing surface
- THEN the Exhibits mode is not offered
- AND the Components mode lists the building-block components

#### Scenario: A surfaces-only catalog omits the Components mode

- GIVEN a showcase that declares page and flow surfaces but no building-block components
- WHEN a viewer opens the browsing surface
- THEN the Components mode is not offered
- AND the Exhibits mode lists the surfaces

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

### Requirement: Default landing mode

The showcase MAY configure which browse mode the root view opens — the primer, the Components mode, or the Exhibits mode. Display Case SHALL honor the configured landing mode only when that mode is present; when it is absent (or unconfigured), Display Case SHALL open the first present mode in a fixed order: primer, then Components, then Exhibits. A deep link to a specific case SHALL open its case regardless of the configured landing mode.

#### Scenario: Configured landing mode is present

- GIVEN a showcase configured to land on the Exhibits mode
- AND the showcase has page or flow surfaces
- WHEN a viewer opens the root view
- THEN the Exhibits mode is shown

#### Scenario: Configured landing mode is absent

- GIVEN a showcase configured to land on the Exhibits mode
- AND the showcase has no page or flow surfaces
- WHEN a viewer opens the root view
- THEN the first present mode is shown instead

#### Scenario: Deep link overrides the landing mode

- GIVEN a showcase with any configured landing mode
- WHEN a viewer opens a specific case's stable address
- THEN that case is shown regardless of the landing mode

### Requirement: Locating items by filtering

The browsing surface SHALL provide a text filter that narrows the active browse mode to the components, cases, and groups whose names match the entered text, so a viewer can locate an item in a large catalog without scrolling the full tree. When the entered text also matches items in the other browse mode, those matches SHALL be presented below the active mode's results, labelled as belonging to the other mode, and SHALL remain reachable — selecting one switches to that mode. When the active mode has no matching items but the other mode does, the active mode SHALL show an explicit no-matches state rather than appearing blank, above the other mode's results. Clearing the filter SHALL restore the full listing. The filter SHALL be a progressive enhancement that does not change case addresses or the initial server-rendered listing.

#### Scenario: Filtering narrows the listing

- GIVEN a browse mode listing many components and groups
- WHEN a viewer enters filter text
- THEN only items whose name matches the text remain listed
- AND a matching item within a group remains reachable under its group

#### Scenario: Matches in the other mode appear below the current results

- GIVEN a viewer is in the Exhibits mode with an active filter
- AND the filter text matches surfaces in the Exhibits mode and a component in the Components mode
- WHEN the viewer reviews the filtered results
- THEN the Exhibits matches are listed first
- AND the Components match is listed below them, labelled as belonging to the Components mode
- AND selecting it switches to that component in the Components mode

#### Scenario: No matches in the active mode but matches in the other

- GIVEN a viewer is in the Exhibits mode with an active filter
- AND the filter text matches no surface in the Exhibits mode but matches a component in the Components mode
- WHEN the viewer reviews the filtered results
- THEN the Exhibits mode shows an explicit no-matches state
- AND the Components match is listed below it and remains reachable

#### Scenario: Clearing the filter restores the listing

- GIVEN a browse mode with an active filter
- WHEN the viewer clears the filter text
- THEN the full listing is restored

#### Scenario: Filtering does not affect addressing

- GIVEN a browse mode with an active filter
- WHEN a viewer opens a case's stable address directly
- THEN that case renders regardless of the filter state

### Requirement: Adjustable, remembered navigation width

The browsing surface SHALL let a viewer adjust the width of the navigation rail — by dragging its edge or via the keyboard — within a minimum and a maximum, so it cannot shrink below a usable size or grow large enough to crowd the preview and documentation. The chosen width SHALL be remembered across sessions. Width adjustment SHALL be a progressive enhancement that does not change the initial server-rendered listing or case addressing.

#### Scenario: Widening the rail

- GIVEN the browsing surface with the navigation rail shown
- WHEN a viewer drags the rail's edge outward
- THEN the rail widens, up to the maximum

#### Scenario: Width is clamped

- GIVEN a viewer adjusting the rail width
- WHEN they attempt to go below the minimum or beyond the maximum
- THEN the width stops at that bound

#### Scenario: Width persists across sessions

- GIVEN a viewer has adjusted the rail width
- WHEN they reopen the showcase later
- THEN the rail is restored to the remembered width

### Requirement: Compact-viewport navigation drawer

On a compact (narrow) viewport, Display Case SHALL keep the navigation rail hidden by default so the preview gets the full width, and SHALL present the rail as a full-width overlay drawer over the content when the viewer opens it. Selecting an item from the drawer SHALL close it.

#### Scenario: Hidden by default on a compact viewport

- GIVEN a compact viewport
- WHEN the browsing surface opens
- THEN the navigation rail is hidden
- AND the preview spans the full width

#### Scenario: Opening the drawer

- GIVEN a compact viewport with the rail hidden
- WHEN the viewer opens the navigation
- THEN the rail overlays the content as a full-width drawer

#### Scenario: Selecting closes the drawer

- GIVEN the navigation drawer open on a compact viewport
- WHEN the viewer selects a component or case
- THEN the drawer closes
- AND the selected case is shown

