## ADDED Requirements

### Requirement: Capture reflects the requested theme in the color-scheme preference

Display Case SHALL, when it renders a case for capture or audit under a requested
theme, present the rendering environment's user-agent color-scheme preference as
matching that theme. As a result, a showcased component that detects the theme
*only* through the user agent's color-scheme preference — the one signal a served
page cannot set for itself — SHALL be captured and audited in the requested theme
rather than in the capture environment's default, for every theme a case is
captured or audited under.

#### Scenario: A preference-only component is captured in the requested theme

- GIVEN a showcased component that detects light versus dark only through the user agent's color-scheme preference
- WHEN Display Case renders that case for capture under the dark theme
- THEN the rendering environment reports the user-agent color-scheme preference as dark
- AND the captured image shows the component in its dark appearance

#### Scenario: Each captured theme reports its matching preference

- GIVEN a case captured under both the light and dark themes
- WHEN each capture is taken
- THEN the light capture reports the user-agent color-scheme preference as light
- AND the dark capture reports it as dark
