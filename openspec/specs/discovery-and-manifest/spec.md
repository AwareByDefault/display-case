# Discovery and Manifest

## Purpose

Display Case discovers component cases colocated with their components and exposes a machine-readable catalog so AI agents can enumerate components and cases without the browsing chrome.

## Requirements

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
