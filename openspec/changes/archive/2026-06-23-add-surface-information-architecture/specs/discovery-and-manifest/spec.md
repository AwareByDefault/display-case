## MODIFIED Requirements

### Requirement: Machine-readable catalog

Display Case SHALL expose a machine-readable catalog that acts as a directory of every discovered component and case. For each component the catalog SHALL include its declared hierarchy level, its resolved information-architecture group path, and file references — at least the case file and the authored usage documentation when present — by path rather than inlined content, so the catalog stays an index. The catalog SHALL also expose the overall information-architecture group structure, so a client can read the grouping without reconstructing it from per-component paths. For each case the catalog SHALL include its stable address and the tweak schema it declares; for a flow, each step SHALL be listed with its own address together with the step's outgoing transitions, each naming its target step. The catalog SHALL be retrievable without rendering the browsing surface.

#### Scenario: An AI agent enumerates components

- GIVEN Display Case is running
- WHEN a machine client requests the catalog
- THEN it receives a structured listing of every component and its cases
- AND each component entry includes its hierarchy level
- AND each component entry includes its resolved information-architecture group path
- AND each case entry includes its stable address and its declared tweak schema
- AND each flow lists its steps with their individual addresses and each step's outgoing transitions
- AND each component entry references its case file and its usage documentation by path when present
- AND the catalog does not inline the contents of those files

#### Scenario: The catalog exposes the group structure

- GIVEN a showcase whose pages and flows resolve to information-architecture groups
- WHEN a machine client requests the catalog
- THEN it receives the overall group structure
- AND each surface's group path can be located within that structure
