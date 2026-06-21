# Hierarchy

## Purpose

Display Case groups discovered components by their declared level in the design hierarchy and presents the groups in order of increasing composition.

## Requirements

### Requirement: Design-hierarchy classification

A case file MAY declare the showcased component's level in the design hierarchy. The supported levels, in order of increasing composition, SHALL be: atom, molecule, organism, template, page, and flow. Display Case SHALL group components by their declared level and SHALL present the groups in that order. A component whose level is not declared SHALL appear in a distinct unclassified group ordered last.

#### Scenario: Components grouped by level

- GIVEN case files that declare different hierarchy levels
- WHEN a viewer opens the browsing surface
- THEN components are grouped by level
- AND the groups appear in order from atom through flow

#### Scenario: Undeclared level

- GIVEN a case file that declares no hierarchy level
- WHEN a viewer opens the browsing surface
- THEN that component appears in an unclassified group ordered after the named levels
