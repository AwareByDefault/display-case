# Render Endpoint

## Purpose

Display Case provides, for each case, an isolated rendering free of the browsing chrome so a client can capture it in light and dark themes.
## Requirements
### Requirement: Isolated case render for snapshotting

Display Case SHALL provide, for each case, an isolated rendering that contains only the case content and the styling required to display it, free of the browsing chrome. The isolated rendering SHALL honor a requested theme so a client can capture both light and dark appearances.

#### Scenario: Snapshotting a single case

- GIVEN a case that exists in the catalog
- WHEN a client requests that case's isolated rendering for a given theme
- THEN it receives only the case content styled for that theme
- AND none of the browsing chrome is present in the result

### Requirement: Imported static assets resolve in the isolated render

Display Case SHALL display, in a case's isolated rendering, a static asset that
the case's component imports and renders (an image or other file-typed import),
rather than a broken reference. The address the rendering gives the client for
that asset SHALL resolve to the served asset bytes. This SHALL hold both in the
development server and in a published build.

The address SHALL be identical in the content rendered before scripting and in
the content produced once the page's scripts run, so the two do not disagree
about where the asset lives.

#### Scenario: A component-imported image displays in the isolated render

- GIVEN a case whose component imports a static asset and renders it
- WHEN a client requests that case's isolated rendering
- THEN the asset's address resolves to the served asset bytes
- AND the asset is displayed rather than a broken reference

#### Scenario: The asset address agrees before and after scripting

- GIVEN a case whose component imports a static asset and renders it
- WHEN the isolated rendering is delivered with its content rendered before scripting
- THEN the address referenced in the pre-scripting content is the same address the client uses once its scripts run

#### Scenario: Imported assets resolve in a published build

- GIVEN a deployable build of a showcase containing such a case
- WHEN the build's isolated rendering for that case is hosted and requested
- THEN the asset's address resolves to the served asset bytes under the build's configured base path

