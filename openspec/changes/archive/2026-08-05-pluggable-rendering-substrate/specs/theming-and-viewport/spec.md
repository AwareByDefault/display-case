## MODIFIED Requirements

### Requirement: Theme and viewport controls

Display Case SHALL present preview variant controls derived from the active
substrate's declared variant axes (see Rendering Substrate). Under the default
substrate these SHALL be a theme control that switches the preview between the
system's light and dark themes and a viewport control that constrains the
preview to a chosen viewport width; the rendered case SHALL reflect the chosen
values without reloading the catalog. Under a substrate that declares
different axes, the same controls surface SHALL present those declared axes
and their values instead, and choosing a value SHALL update the preview
without reloading the catalog.

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

#### Scenario: A non-default substrate's axes replace theme and viewport

- GIVEN a showcase whose substrate declares variant axes other than theme and viewport width
- WHEN a viewer opens the preview controls
- THEN the controls present the substrate's declared axes and their values
- AND choosing a value updates the preview without reloading the catalog

### Requirement: Theme applied through configurable root indicators

When the active substrate declares a light/dark theme axis (as the default
substrate does), Display Case SHALL apply the chosen preview theme to the
document root as a configurable set of theme indicators, covering the common
conventions by which a showcased component detects light versus dark. A
showcased component that detects the theme through any configured indicator —
whether it reads that indicator on the root itself or inherits it from an
ancestor — SHALL reflect the chosen theme. The default set SHALL cover the
showcase's own theming convention and the widely-used class-based convention;
additional conventions and a viewer-supplied custom indicator SHALL be
enable-able through configuration. Applying or switching the theme SHALL
update the full configured set in place, without reloading the catalog.

The configuration that selects which indicators are applied SHALL be declarative
data (a description of the indicators to emit), so that the same selection can be
applied both to the document delivered before scripting and by the running client;
it SHALL NOT require executing viewer-supplied code to compute an indicator.

#### Scenario: Component using a configured convention follows the toggle

- GIVEN a showcased component that detects the theme through a configured root indicator
- AND a case rendered in the preview area
- WHEN the viewer switches the theme to dark
- THEN the component re-renders under the dark theme
- AND switching back to light restores the light appearance

#### Scenario: A nested component inherits the theme indicators

- GIVEN a showcased component that detects the theme through a configured indicator on an ancestor rather than on itself
- WHEN the viewer switches the preview theme
- THEN that component reflects the switched theme by inheritance

#### Scenario: Default indicators cover the common conventions with no configuration

- GIVEN a showcase with no theme configuration
- WHEN a case is rendered under the dark theme
- THEN the preview carries the showcase's own theme indicator and the class-based indicator for the dark theme
- AND a component reading either convention presents in the dark theme

#### Scenario: A viewer enables an additional or custom indicator

- GIVEN a showcase configured to emit an additional named convention or a custom indicator
- WHEN a case is rendered under a chosen theme
- THEN the preview root additionally carries that configured indicator for the chosen theme
- AND a component reading that convention reflects the chosen theme
