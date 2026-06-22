## ADDED Requirements

### Requirement: Prose code samples are not executed as specimens

A primer's prose MAY include fenced code samples. Such samples SHALL render as
formatted, inert code and SHALL NOT be interpreted or executed as live component
specimens, even when their contents resemble specimen markup.

#### Scenario: A code sample that looks like a specimen

- GIVEN a primer whose prose contains a fenced code sample that itself contains
  component-specimen markup
- WHEN the primer is rendered
- THEN the sample appears as formatted code
- AND it is not rendered as a live specimen
