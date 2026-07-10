## ADDED Requirements

### Requirement: Configured theme indicators present before scripting

The themed document Display Case delivers before scripting SHALL carry, on the
document root, the full configured set of theme indicators for the requested theme
— not only the showcase's own indicator. A client that retrieves such a document
and does not execute its scripts SHALL already receive every configured indicator
for the requested theme, so that a showcased component detecting the theme through
any configured convention presents in the requested theme on first paint, without a
change once the page's scripts run. When the viewer switches the theme in place, the
running client SHALL update the full configured set together, so no configured
indicator lags behind the others.

#### Scenario: Configured indicators present without executing scripts

- GIVEN a showcase configured to emit a theme convention beyond the showcase's own
- AND an address that requests the dark theme
- WHEN a client retrieves the document and does not execute the page's scripts
- THEN the delivered document already carries every configured theme indicator for the dark theme
- AND a component reading any configured convention presents in the dark theme rather than its default appearance
- AND no configured indicator changes once the page's scripts run

#### Scenario: Interactive switch updates the whole set together

- GIVEN a delivered surface carrying several configured theme indicators for the light theme
- WHEN the viewer switches the preview theme to dark in place
- THEN every configured indicator updates to the dark theme together
- AND no configured indicator remains on the previous theme
