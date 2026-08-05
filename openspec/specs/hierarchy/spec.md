# Hierarchy

## Purpose

Display Case groups discovered components by their declared level in the design hierarchy and presents the groups in order of increasing composition.
## Requirements
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

### Requirement: Substrate-supplied level display labels

The design-hierarchy level set and its order SHALL be fixed across substrates:
a substrate SHALL NOT add, remove, or reorder levels. The active substrate MAY
supply display labels for the levels, and the browsing surface SHALL present a
level under its substrate-supplied label where one is given, while
classification, grouping, browse modes, and structure rules continue to
operate on the fixed level set.

#### Scenario: A substrate relabels a level for display

- GIVEN a showcase whose substrate supplies a display label for the page level
- WHEN a viewer browses the catalog
- THEN page-level surfaces are presented under the substrate's label
- AND their classification, grouping, and addresses are unchanged

#### Scenario: The taxonomy itself cannot be altered

- GIVEN any active substrate
- WHEN components are classified and the structure rules run
- THEN the level set and its order are the fixed atom-through-flow taxonomy
- AND no substrate-defined level exists

