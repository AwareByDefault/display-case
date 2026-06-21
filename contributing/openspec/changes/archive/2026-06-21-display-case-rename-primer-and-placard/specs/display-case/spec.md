## MODIFIED Requirements

<!-- Renamed from "Authored placard". The surface and its behavior are unchanged;
     only the name of the whole-collection reading surface changes (placard → primer). -->
### Requirement: Authored primer

A showcase MAY include an authored primer — a single long-form reading surface that interleaves formatted prose with live component specimens drawn from the showcase. When a primer is authored, Display Case SHALL offer a way to switch the browsing surface between the component catalog and the primer, and SHALL render the primer's prose as formatted text with its embedded specimens live. Each specimen MAY carry a title, a subtitle, and a forced theme that applies to that specimen alone regardless of the surface's current theme. Display Case SHALL present the primer's titled sections as a navigable table of contents that reflects the section currently in view and lets a viewer jump to a section. The primer SHALL have an isolated rendering free of the browsing chrome. When no primer is authored, no switch is offered and the catalog is the only surface.

#### Scenario: Switching to the primer

- GIVEN a showcase that includes an authored primer
- WHEN a viewer switches the browsing surface from the catalog to the primer
- THEN the primer renders its prose as formatted text with its live specimens
- AND the viewer can switch back to the component catalog

#### Scenario: Navigating primer sections

- GIVEN the primer is shown and contains multiple titled sections
- WHEN a viewer selects a section from the table of contents
- THEN the primer scrolls to that section
- AND the table of contents reflects the section currently in view as the viewer scrolls

#### Scenario: Specimen with a forced theme

- GIVEN a primer specimen that declares a forced theme
- WHEN the primer is viewed under the opposite surface theme
- THEN that specimen renders under its forced theme
- AND the remaining specimens render under the surface's current theme

#### Scenario: No primer authored

- GIVEN a showcase that includes no authored primer
- WHEN a viewer opens the browsing surface
- THEN no primer switch is offered
- AND the component catalog is the only surface

<!-- Renamed from "Placard presence and use". Same checked conditions; rule id
     placard-present-and-used → primer-present-and-used. -->
### Requirement: Primer presence and use

When its rule is enabled, the structure checks SHALL verify that the showcase provides a primer that is configured, exists, embeds at least one live specimen using the specimen contract, and is not effectively empty. A primer that is unconfigured, absent, contentless, or that embeds no specimen using the specimen contract SHALL be reported. Disabling this rule SHALL suppress these reports, consistent with a primer being optional.

#### Scenario: No primer configured

- GIVEN a showcase that configures no primer
- AND the primer rule is enabled
- WHEN the primer check runs
- THEN the showcase is reported as missing a primer

#### Scenario: Primer configured but empty

- GIVEN a showcase that configures a primer that exists but is effectively empty or embeds no specimen using the specimen contract
- WHEN the primer check runs
- THEN the primer is reported as present but unused

#### Scenario: Primer present and used

- GIVEN a showcase that configures a primer that exists, is non-trivial, and embeds at least one live specimen using the specimen contract
- WHEN the primer check runs
- THEN the primer produces no violation

#### Scenario: Primer rule disabled

- GIVEN a showcase that configures no primer
- AND the primer rule is disabled
- WHEN the structure checks run
- THEN no primer violation is reported
