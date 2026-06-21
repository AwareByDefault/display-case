## ADDED Requirements

### Requirement: Render-time style collection

Display Case SHALL provide a means by which a showcase can have styling that is
produced as a side effect of rendering — emitted while a component renders, rather
than declared in a static stylesheet — collected during the pre-scripting render
of an isolated case render and of the primer, and delivered in that surface's
document before scripting, so the surface appears in its styled form when
retrieved without executing scripts.

The means SHALL be optional: a showcase that does not configure it SHALL produce
documents identical to those it would produce in its absence. A showcase MAY
configure more than one such means, applied in a defined order.

Collected render-time styling SHALL be isolated per render: the styling delivered
in one case's document SHALL reflect only that render, and SHALL NOT include or be
polluted by styling produced for any other render.

The styling delivered for a render SHALL be delivered such that, when the page's
scripts run, the styling library adopts the already-delivered styling rather than
re-applying or duplicating it — so no flash of unstyled content and no restyle
occurs, and the surface is not styled twice.

A case that cannot render outside a browser SHALL be exempt: its render-time
styling, like its content, is produced in the client, and its exemption SHALL NOT
cause the surrounding surface to fail or to lose its own pre-scripting styling.

#### Scenario: Render-time styling present without executing scripts

- GIVEN a showcase configured to collect render-time styling
- AND a case whose component emits its styling as a side effect of rendering
- WHEN a client retrieves that case's isolated rendering and does not execute the page's scripts
- THEN the delivered document already carries the styling that render produced
- AND the case appears in its styled form, not merely structurally present

#### Scenario: Per-render isolation between cases

- GIVEN two cases whose components emit different render-time styling
- WHEN each case's isolated rendering is delivered
- THEN each document carries only the styling its own render produced
- AND neither document carries styling produced for the other

#### Scenario: Adoption without duplication when scripts run

- GIVEN a delivered document already carrying a render's collected styling
- WHEN the page's scripts run and the styling library initializes in the client
- THEN the library adopts the already-delivered styling rather than re-applying it
- AND no flash of unstyled content occurs, no restyle happens, and the styling is not duplicated

#### Scenario: Primer specimens styled before scripting

- GIVEN a primer whose embedded specimens emit render-time styling
- WHEN the primer document is retrieved without executing the page's scripts
- THEN the delivered document already carries the styling those specimens produced

#### Scenario: A browser-only case is exempt

- GIVEN a showcase configured to collect render-time styling
- AND a case whose component is declared to require a browser
- WHEN that case's surface is delivered
- THEN no render-time styling is collected for it server-side
- AND its styling is produced once the page's scripts run
- AND the surrounding surface still delivers its own content and styling before scripting

#### Scenario: No collection configured leaves documents unchanged

- GIVEN a showcase that configures no render-time style collection
- WHEN any surface is delivered
- THEN the delivered document is identical to the one produced without this means
