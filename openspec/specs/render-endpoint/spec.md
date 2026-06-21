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
