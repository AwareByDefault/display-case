## ADDED Requirements

### Requirement: Authored placard

A showcase MAY include an authored placard — a single long-form reading surface that interleaves formatted prose with live component specimens drawn from the showcase. When a placard is authored, Display Case SHALL offer a way to switch the browsing surface between the component catalog and the placard, and SHALL render the placard's prose as formatted text with its embedded specimens live. Each specimen MAY carry a title, a subtitle, and a forced theme that applies to that specimen alone regardless of the surface's current theme. Display Case SHALL present the placard's titled sections as a navigable table of contents that reflects the section currently in view and lets a viewer jump to a section. The placard SHALL have an isolated rendering free of the browsing chrome. When no placard is authored, no switch is offered and the catalog is the only surface.

#### Scenario: Switching to the placard

- GIVEN a showcase that includes an authored placard
- WHEN a viewer switches the browsing surface from the catalog to the placard
- THEN the placard renders its prose as formatted text with its live specimens
- AND the viewer can switch back to the component catalog

#### Scenario: Navigating placard sections

- GIVEN the placard is shown and contains multiple titled sections
- WHEN a viewer selects a section from the table of contents
- THEN the placard scrolls to that section
- AND the table of contents reflects the section currently in view as the viewer scrolls

#### Scenario: Specimen with a forced theme

- GIVEN a placard specimen that declares a forced theme
- WHEN the placard is viewed under the opposite surface theme
- THEN that specimen renders under its forced theme
- AND the remaining specimens render under the surface's current theme

#### Scenario: No placard authored

- GIVEN a showcase that includes no authored placard
- WHEN a viewer opens the browsing surface
- THEN no placard switch is offered
- AND the component catalog is the only surface
