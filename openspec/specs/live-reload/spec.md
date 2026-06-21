# Live Reload

## Purpose

Display Case reflects edits to the material it presents while running, without requiring the viewer to manually restart the tool.

## Requirements

### Requirement: Live authoring updates

Display Case SHALL reflect edits to the material it presents while running,
without requiring the viewer to manually restart the tool — whether the edit
adds or changes a case, a component's usage documentation, primer content, or a
component's own implementation. The current selection SHALL be preserved across
such an update where it still exists. When a change affects a variant's rendered
output and accessibility surfacing is configured, that variant's accessibility
result SHALL be re-evaluated to reflect the change.

#### Scenario: Editing a case while running

- GIVEN Display Case is running and a case is selected
- WHEN the author changes that case's definition
- THEN the rendered case reflects the change without a manual restart
- AND the case remains the active selection

#### Scenario: Adding a case while running

- GIVEN Display Case is running
- WHEN the author adds a new case file colocated with a component
- THEN the new case appears in the catalog without a manual restart

#### Scenario: Editing a component implementation while running

- GIVEN Display Case is running and a case for a component is selected
- WHEN the author changes that component's implementation source
- THEN the rendered case reflects the change without a manual restart
- AND the case remains the active selection

#### Scenario: Accessibility re-evaluated after an edit

- GIVEN Display Case is running with accessibility surfacing configured and a case selected
- WHEN an edit changes that case's rendered output
- THEN that case's accessibility result is re-evaluated and the surfaced verdict updates
