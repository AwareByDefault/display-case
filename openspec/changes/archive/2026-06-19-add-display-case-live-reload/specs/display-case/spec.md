## ADDED Requirements

### Requirement: Live authoring updates

While Display Case is running, edits to the authored material it presents — adding or changing a case, a component's usage documentation, or placard content — SHALL be reflected on the browsing surface without requiring the viewer to manually restart the tool. The current selection SHALL be preserved across such an update where it still exists.

#### Scenario: Editing a case while running

- GIVEN Display Case is running and a case is selected
- WHEN the author changes that case's definition
- THEN the rendered case reflects the change without a manual restart
- AND the case remains the active selection

#### Scenario: Adding a case while running

- GIVEN Display Case is running
- WHEN the author adds a new case file colocated with a component
- THEN the new case appears in the catalog without a manual restart
