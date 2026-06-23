## MODIFIED Requirements

### Requirement: Design-hierarchy classification

A case file MAY declare the showcased component's level in the design hierarchy. The supported levels, in order of increasing composition, SHALL be: atom, molecule, organism, template, page, and flow. The declared level SHALL classify every component for composition purposes regardless of how it is presented for browsing. Display Case SHALL group the building-block levels — atom through template — by level in the Components browse mode and SHALL present those groups in that order. Pages and flows SHALL instead be organized for browsing by their information-architecture group in the Exhibits browse mode rather than collected under a single per-level heading (see Information Architecture). A building-block component whose level is not declared SHALL appear in a distinct unclassified group ordered last.

#### Scenario: Building-block components grouped by level

- GIVEN case files at the atom through template levels
- WHEN a viewer opens the Components browse mode
- THEN those components are grouped by level
- AND the groups appear in order from atom through template

#### Scenario: Pages and flows organized by information architecture

- GIVEN case files at the page and flow levels
- WHEN a viewer opens the Exhibits browse mode
- THEN those surfaces are organized by their information-architecture group
- AND they are not collected under a single page or flow heading

#### Scenario: Undeclared level

- GIVEN a building-block case file that declares no hierarchy level
- WHEN a viewer opens the Components browse mode
- THEN that component appears in an unclassified group ordered after the named levels
