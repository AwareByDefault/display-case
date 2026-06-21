# Theming and Viewport

Display Case lets a viewer switch the preview between light and dark themes and constrain it to a chosen viewport width.

## Requirements

### Requirement: Theme and viewport controls

Display Case SHALL let a viewer switch the preview between the system's light and dark themes, and SHALL let a viewer constrain the preview to a chosen viewport width. The rendered case SHALL reflect the chosen theme and width without reloading the catalog.

#### Scenario: Switching theme

- GIVEN a case rendered in the preview area
- WHEN the viewer switches the theme to dark
- THEN the case re-renders under the dark theme
- AND switching back to light restores the light appearance

#### Scenario: Constraining width

- GIVEN a case rendered in the preview area
- WHEN the viewer selects a narrower viewport width
- THEN the preview area is constrained to that width
- AND the case reflows to that width
