## ADDED Requirements

### Requirement: Case discovery

Display Case SHALL discover component cases from case files colocated with the components they showcase. A case file SHALL declare one or more named cases, each associating a human-readable name with a renderable component variant or state. Cases SHALL be grouped by the component they belong to.

#### Scenario: A new case file is picked up

- GIVEN a case file colocated with a component declaring one or more named cases
- WHEN Display Case is started
- THEN every declared case appears in the catalog grouped under its component

#### Scenario: A component with no case file

- GIVEN a component that has no colocated case file
- WHEN Display Case is started
- THEN that component does not appear in the catalog
- AND no error is raised for its absence

#### Scenario: A malformed case file

- GIVEN a case file that fails to load
- WHEN Display Case is started
- THEN the failure is reported with the offending file identified
- AND the remaining cases still load and render

### Requirement: Design-hierarchy classification

A case file MAY declare the showcased component's level in the design hierarchy. The supported levels, in order of increasing composition, SHALL be: atom, molecule, organism, template, page, and prototype. Display Case SHALL group components by their declared level and SHALL present the groups in that order. A component whose level is not declared SHALL appear in a distinct unclassified group ordered last.

#### Scenario: Components grouped by level

- GIVEN case files that declare different hierarchy levels
- WHEN a viewer opens the browsing surface
- THEN components are grouped by level
- AND the groups appear in order from atom through prototype

#### Scenario: Undeclared level

- GIVEN a case file that declares no hierarchy level
- WHEN a viewer opens the browsing surface
- THEN that component appears in an unclassified group ordered after the named levels

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

### Requirement: Theme and viewport controls

Display Case SHALL let a viewer switch the preview between the system's light and dark themes, and SHALL let a viewer constrain the preview to a chosen viewport width. The rendered case SHALL reflect the chosen theme and width without reloading the catalog.

#### Scenario: Switching theme

- GIVEN a case rendered in the preview area
- WHEN the viewer switches the theme to dark
- THEN the case re-renders under the dark theme
- AND switching back to light restores the light appearance

#### Scenario: Constraining width

- GIVEN a case rendered in the preview area
- WHEN the viewer selects a narrower viewport width
- THEN the preview area is constrained to that width
- AND the case reflows to that width

### Requirement: Tweaks (interactive controls)

A case MAY declare tweaks — named, typed inputs (at least text, boolean, number, and a fixed-option choice) with default values. When a case declares tweaks, Display Case SHALL present a controls panel that lets a viewer change each tweak's value and SHALL re-render the case with the changed values. The current tweak values SHALL be encoded in the case's address so a tweaked state is shareable and reproduces on reload.

#### Scenario: Adjusting a tweak

- GIVEN a case that declares a tweak with a default value
- WHEN a viewer changes that tweak in the controls panel
- THEN the case re-renders using the new value
- AND the case's address updates to encode the new value

#### Scenario: Reproducing a tweaked state

- GIVEN an address that encodes non-default tweak values for a case
- WHEN a viewer opens that address
- THEN the case renders with those tweak values applied

#### Scenario: A case without tweaks

- GIVEN a case that declares no tweaks
- WHEN a viewer selects it
- THEN it renders normally with no controls panel and no error

### Requirement: Prototype multi-page flows

A prototype is a showcased entry at the prototype hierarchy level that comprises multiple ordered pages demonstrating a multi-page behaviour or user flow. Display Case SHALL let a viewer move between the pages of a prototype to walk the flow, SHALL render one page at a time in the preview area, and SHALL make each page individually addressable so it can be deep-linked and snapshotted on its own. Interaction within a rendered page SHALL behave as it would in the real flow.

#### Scenario: Stepping through a flow

- GIVEN a prototype that declares multiple ordered pages
- WHEN a viewer selects the prototype
- THEN the first page renders in the preview area
- AND the viewer can advance to the next page and return to the previous one

#### Scenario: Deep-linking to a flow page

- GIVEN a prototype with multiple pages
- WHEN a viewer opens the address of a specific page of that prototype
- THEN that page renders directly as the active page of the flow

#### Scenario: Snapshotting a single flow page

- GIVEN a prototype with multiple pages
- WHEN a client requests the isolated rendering of one of its pages
- THEN it receives only that page's content, free of the browsing chrome

### Requirement: Inline documentation panel

When a component has authored usage documentation, Display Case SHALL offer, within the preview, a documentation panel that renders that documentation as formatted text and that a viewer can show or hide. Components without authored documentation SHALL omit the panel.

#### Scenario: Viewing component documentation

- GIVEN a component whose case is selected and that has authored usage documentation
- WHEN the viewer reveals the documentation panel
- THEN the documentation renders as formatted text within the preview
- AND the viewer can hide it again

#### Scenario: Component without documentation

- GIVEN a component that has no authored usage documentation
- WHEN its case is selected
- THEN no documentation panel is offered

### Requirement: Accessibility checks

Display Case SHALL be able to run automated accessibility checks against the rendered cases and report violations per case. The checks SHALL be runnable without the interactive browsing surface, and SHALL exit non-zero when any case has a violation so the run can gate other processes.

#### Scenario: A case with an accessibility violation

- GIVEN a case whose rendered output has an accessibility violation
- WHEN the accessibility checks are run
- THEN the violation is reported attributed to that case
- AND the run exits non-zero

#### Scenario: All cases pass accessibility checks

- GIVEN every case renders without accessibility violations
- WHEN the accessibility checks are run
- THEN the run reports success and exits zero

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

### Requirement: Machine-readable catalog

Display Case SHALL expose a machine-readable catalog that acts as a directory of every discovered component and case. For each component the catalog SHALL include its declared hierarchy level and file references — at least the case file and the authored usage documentation when present — by path rather than inlined content, so the catalog stays an index. For each case the catalog SHALL include its stable address and the tweak schema it declares; for a prototype, each page SHALL be listed with its own address. The catalog SHALL be retrievable without rendering the browsing surface.

#### Scenario: An AI agent enumerates components

- GIVEN Display Case is running
- WHEN a machine client requests the catalog
- THEN it receives a structured listing of every component and its cases
- AND each component entry includes its hierarchy level
- AND each case entry includes its stable address and its declared tweak schema
- AND each prototype lists its pages with their individual addresses
- AND each component entry references its case file and its usage documentation by path when present
- AND the catalog does not inline the contents of those files

### Requirement: Isolated case render for snapshotting

Display Case SHALL provide, for each case, an isolated rendering that contains only the case content and the styling required to display it, free of the browsing chrome. The isolated rendering SHALL honor a requested theme so a client can capture both light and dark appearances.

#### Scenario: Snapshotting a single case

- GIVEN a case that exists in the catalog
- WHEN a client requests that case's isolated rendering for a given theme
- THEN it receives only the case content styled for that theme
- AND none of the browsing chrome is present in the result

### Requirement: Development-only tool

Display Case SHALL be a development-only tool. It SHALL NOT be included in any deployed application artifact, and SHALL NOT be required for any application to build or run.

#### Scenario: Application build excludes Display Case

- GIVEN the production build of any application in the repository
- WHEN the build is produced
- THEN it does not include Display Case
- AND the application builds and runs without Display Case present
