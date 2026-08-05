## MODIFIED Requirements

### Requirement: Isolated case render for snapshotting

Display Case SHALL provide, for each case, an isolated rendering that contains
only the case content and the presentation required to display it, free of the
browsing chrome. The isolated rendering SHALL be the stage document produced
by the active substrate (see Rendering Substrate), and SHALL honor the
rendering-selecting variant values requested in its address — under the
default substrate, the requested light or dark theme — so a client can capture
each declared appearance of the case.

#### Scenario: Snapshotting a single case

- GIVEN a case that exists in the catalog
- WHEN a client requests that case's isolated rendering for a given theme under the default substrate
- THEN it receives only the case content styled for that theme
- AND none of the browsing chrome is present in the result

#### Scenario: Requested variant values honored under a non-default substrate

- GIVEN a showcase whose substrate declares rendering-selecting variant axes other than theme
- WHEN a client requests a case's isolated rendering with values for those axes in the address
- THEN it receives the substrate's stage document for the case rendered under those values
- AND none of the browsing chrome is present in the result
