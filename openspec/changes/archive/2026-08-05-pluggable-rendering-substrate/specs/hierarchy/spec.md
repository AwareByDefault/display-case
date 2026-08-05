## ADDED Requirements

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
