# Placard Docs

When a component has authored usage documentation, Display Case offers an inline documentation panel within the preview.

## Requirements

### Requirement: Inline documentation panel

When a component has authored usage documentation, Display Case SHALL offer, within the preview, a documentation panel that renders that documentation as formatted text and that a viewer can show or hide. Components without authored documentation SHALL omit the panel.

#### Scenario: Viewing component documentation

- GIVEN a component whose case is selected and that has authored usage documentation
- WHEN the viewer reveals the documentation panel
- THEN the documentation renders as formatted text within the preview
- AND the viewer can hide it again

#### Scenario: Component without documentation

- GIVEN a component that has no authored usage documentation
- WHEN its case is selected
- THEN no documentation panel is offered
