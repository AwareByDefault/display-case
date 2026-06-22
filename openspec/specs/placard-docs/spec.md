# Placard Docs

## Purpose

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

### Requirement: Documentation rendering excludes author-supplied raw HTML

The documentation panel SHALL render a component's authored documentation as formatted text without rendering or executing any raw HTML or scripts present in the source. Markup the author writes as raw HTML SHALL NOT appear in the chrome as live elements, and any embedded script SHALL NOT execute.

#### Scenario: Raw HTML in a doc is not rendered as markup

- GIVEN a component whose authored documentation contains raw HTML tags such as `<b>` or `<div>`
- WHEN the viewer reveals the documentation panel
- THEN that HTML is not rendered as live elements in the chrome

#### Scenario: Embedded script does not execute

- GIVEN a component whose authored documentation contains a `<script>` tag
- WHEN the viewer reveals the documentation panel
- THEN the script is not injected into the page and does not execute

