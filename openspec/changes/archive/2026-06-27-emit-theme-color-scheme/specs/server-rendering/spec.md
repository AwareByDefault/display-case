## ADDED Requirements

### Requirement: User-agent color scheme matches the theme

The themed document Display Case delivers before scripting SHALL declare a color
scheme matching the requested theme, so that controls and surfaces rendered by the
user agent — form controls, scrollbars, and other default control chrome — present
in the requested theme rather than in a default light appearance. This declaration
SHALL be delivered before scripting alongside the rest of the surface's theming,
so that the first paint already presents user-agent-rendered controls in the
requested theme and they do not restyle once the page's scripts run. When the
preview theme changes interactively, the declared color scheme SHALL update to
match, so user-agent-rendered controls re-theme together with the rest of the
surface and do not remain in the previous theme.

This requirement governs only how user-agent-rendered surfaces are themed; it does
not impose any styling on a showcased component's own controls, which render as the
component authors them.

#### Scenario: Color scheme present without executing scripts

- GIVEN an address that requests the dark theme
- WHEN a client retrieves the document and does not execute the page's scripts
- THEN the delivered document already declares a color scheme matching the dark theme
- AND a user-agent-rendered control with no authored background presents in the dark theme rather than a default light appearance

#### Scenario: Color scheme matches each requested theme

- GIVEN the same case requested once under the light theme and once under the dark theme
- WHEN each document is delivered
- THEN each declares a color scheme matching its requested theme
- AND user-agent-rendered controls present in that theme in each

#### Scenario: Color scheme follows an interactive theme switch

- GIVEN a surface delivered in the dark theme whose user-agent-rendered controls present in the dark theme
- WHEN the page's scripts run and a viewer switches the theme to light
- THEN the declared color scheme updates to the light theme
- AND the user-agent-rendered controls present in the light theme rather than remaining dark
