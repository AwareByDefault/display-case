## ADDED Requirements

### Requirement: Surface grouping by information architecture

Display Case SHALL organize pages and flows — the application's surfaces, listed in the Exhibits browse mode — into named information-architecture groups, independent of their design-hierarchy level. A group SHALL be a path of one or more ordered segments, so that groups MAY nest. Display Case SHALL present each surface under its group, and a surface's level SHALL NOT be required to appear in its group placement.

#### Scenario: Surfaces presented under their groups

- GIVEN pages and flows that resolve to different information-architecture groups
- WHEN a viewer opens the Exhibits mode
- THEN each page and flow appears under its own group
- AND surfaces are not collected beneath a single page or flow heading

#### Scenario: Nested groups

- GIVEN a surface whose group is a multi-segment path
- WHEN a viewer opens the Exhibits mode
- THEN the surface appears nested under each segment of its group path in order

#### Scenario: A grouped surface keeps its level classification

- GIVEN a page assigned to an information-architecture group
- WHEN the machine-readable catalog is requested
- THEN the page still reports its declared hierarchy level
- AND it also reports its information-architecture group

### Requirement: Group resolution

Display Case SHALL determine a surface's information-architecture group from the first available of, in order: a group declared on the surface, a group derived from the surface's source location relative to the discovered sources, a group assigned by showcase configuration, and otherwise a single default group. A surface that resolves to no declared, derived, or configured group SHALL be placed in the default group rather than omitted or rejected.

#### Scenario: Explicit group wins

- GIVEN a surface that declares a group
- AND whose source location would derive a different group
- WHEN its group is resolved
- THEN the declared group is used

#### Scenario: Group derived from source location

- GIVEN a surface that declares no group
- AND whose source is located within a named path among the discovered sources
- WHEN its group is resolved
- THEN its group is derived from that location

#### Scenario: Configured group assignment

- GIVEN a surface that declares no group and whose location derives none
- AND a showcase configuration that assigns it to a group
- WHEN its group is resolved
- THEN the configured group is used

#### Scenario: Ungrouped surface falls back to a default group

- GIVEN a surface with no declared, derived, or configured group
- WHEN its group is resolved
- THEN it is placed in a single default group
- AND it still appears in the Exhibits mode

### Requirement: Configurable group order, labels, and default state

A showcase SHALL be able to declare the order in which information-architecture groups appear, override a group's display label, and mark groups as collapsed by default. Absent such configuration, groups SHALL appear in a deterministic default order. A group named in this configuration that no surface resolves to SHALL be reported as an unused group reference and SHALL NOT, by itself, fail the run.

#### Scenario: Configured group order

- GIVEN a showcase configuration that declares an order for its groups
- WHEN a viewer opens the Exhibits mode
- THEN the groups appear in the configured order
- AND groups not named in the configuration appear after the configured ones in the default order

#### Scenario: Overridden group label

- GIVEN a showcase configuration that overrides a group's display label
- WHEN a viewer opens the Exhibits mode
- THEN that group is shown with the overridden label
- AND the surfaces under it are unchanged

#### Scenario: Default-collapsed group

- GIVEN a showcase configuration that marks a group collapsed by default
- WHEN a viewer first opens the Exhibits mode
- THEN that group is rendered collapsed
- AND the viewer can expand it

#### Scenario: Configuration references an unknown group

- GIVEN a showcase configuration that names a group no surface resolves to
- WHEN the static checks run
- THEN the unused group reference is reported
- AND it does not by itself fail the run

### Requirement: Active surface group path

Display Case SHALL present the full information-architecture group path of the active surface, so a viewer or agent can place the surface within the catalog. For a surface in the default group, presenting no path SHALL be acceptable.

#### Scenario: Group path shown for a grouped surface

- GIVEN an active page or flow that resolves to a multi-segment group
- WHEN it is rendered in the Exhibits mode
- THEN its full group path is presented for orientation

#### Scenario: No path required in the default group

- GIVEN an active surface in the default group
- WHEN it is rendered in the Exhibits mode
- THEN presenting no group path is acceptable
