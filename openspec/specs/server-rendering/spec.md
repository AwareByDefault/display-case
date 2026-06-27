# Server Rendering

## Purpose

Display Case delivers every surface with its content already rendered before any scripts execute, and provides a check that verifies every case can render before scripting.

## Requirements

### Requirement: Pre-scripting rendered content

Display Case SHALL deliver each browsing surface, isolated case render, and primer as a document whose content is already rendered — laid out and themed for the requested theme — before any of the page's own scripts execute. A client that retrieves such an address and does not execute its scripts SHALL still receive that address's content, not an empty shell. The styling required to present that content as it appears once the surface is interactive SHALL itself be delivered before scripting: a surface retrieved without executing scripts SHALL appear in its styled form, not merely structurally present, and SHALL NOT restyle once the page's scripts run. For a browsing surface, the content present before scripting SHALL include the component catalog and the selected case's framing, and the catalog needed for that first paint SHALL be embedded in the delivered document so no separate catalog request is required before content appears. Interactive behaviors of those surfaces (theme switching, viewport changes, tweak controls, catalog navigation, primer navigation) MAY depend on the page's scripts, but the initial rendered content and its styling SHALL NOT. The content delivered before scripting SHALL be the same content the surface produces once interactive, so that themes, snapshots, and addresses are unchanged.

When a case cannot be rendered outside a browser, Display Case SHALL still present that case by rendering it in the client, and SHALL NOT let that case prevent the surrounding surface from delivering its content before scripting.

#### Scenario: Content present without executing scripts

- GIVEN a case that exists in the catalog
- WHEN a client retrieves that case's isolated rendering and does not execute the page's scripts
- THEN the delivered document already contains the case content
- AND the content is styled for the requested theme

#### Scenario: Styling present without executing scripts

- GIVEN a surface whose chrome and rendered content rely on the design system's component styling
- WHEN a client retrieves that surface — including the isolated, chrome-free render — and does not execute the page's scripts
- THEN the delivered document already carries the styling that presents its content as it appears once interactive
- AND no flash of unstyled content occurs and no restyle happens once the page's scripts run

#### Scenario: Browsing surface content present without executing scripts

- GIVEN a showcase with discovered components
- WHEN a client retrieves the browsing surface — its landing address or a case deep link — and does not execute the page's scripts
- THEN the delivered document already contains the component catalog and the selected case's framing
- AND the content is styled for the requested theme
- AND no separate catalog request is required before that content appears

#### Scenario: Requested theme reflected in the initial content

- GIVEN an address that requests the dark theme
- WHEN the document is delivered
- THEN the initial rendered content is already in the dark theme
- AND no theme change occurs once the page's scripts run

#### Scenario: Shared tweaked address renders before scripting

- GIVEN an address that encodes non-default tweak values for a case
- WHEN the document is delivered
- THEN the initial rendered content already reflects those tweak values

#### Scenario: A case that cannot render outside a browser

- GIVEN a case that requires a browser to render
- WHEN its surface is delivered
- THEN the surrounding surface's content is still present before scripting
- AND that case renders once the page's scripts run
- AND the surface does not error

#### Scenario: Interactivity layered on after content

- GIVEN a surface whose initial content was delivered before scripting
- WHEN the page's scripts run and a viewer switches theme, changes the viewport width, adjusts a tweak, or navigates the catalog or primer
- THEN the surface responds to the interaction as before
- AND the initial content was usable prior to that interaction

### Requirement: Server-render safety check

Display Case SHALL provide a check that verifies every case can be rendered before scripting, and SHALL fail when a case cannot — except for a case whose component is declared to require a browser. A case file MAY declare a component as requiring a browser; such a component SHALL be exempt from this check and SHALL be rendered in the client wherever it appears, rather than failing or blanking the surrounding surface. The check SHALL identify each failing case by its component, case, and source file, and SHALL be runnable on its own without rendering in a browser.

The check renders each case with the same component runtime the cases are built on. When the check's renderer resolves a *different instance* of that shared runtime than the cases do — so that no case can render for a reason that is environmental, not a property of any component — the check SHALL recognize that condition and report it **once**, as a single environment fault, rather than as a separate per-case failure for every affected case. That single fault SHALL identify the conflicting runtime copies and SHALL prescribe how to reconcile them to one, and SHALL NOT attribute the failure to any component's source or recommend changing component code. A render failure that is *not* explained by such an environment fault SHALL still be reported per case, by its component, case, and source file. A showcase whose every case shares one runtime instance, and a showcase that needs no such runtime at all, SHALL NOT be reported as an environment fault.

#### Scenario: A case that cannot render before scripting fails the check

- GIVEN a case that requires a browser to render and is not declared as requiring one
- WHEN the server-render safety check is run
- THEN the check fails
- AND it identifies the offending case by its component, case, and source file

#### Scenario: A case that renders before scripting passes the check

- GIVEN a showcase whose every case can render before scripting
- WHEN the server-render safety check is run
- THEN the check passes

#### Scenario: A component declared to require a browser is exempt

- GIVEN a case whose component is declared to require a browser
- WHEN the server-render safety check is run
- THEN that component's cases do not fail the check
- AND they are reported as declared rather than as failures

#### Scenario: An environment fault is reported once, not per case

- GIVEN a showcase whose cases cannot render because the check's renderer resolved a different instance of the shared component runtime than the cases use
- WHEN the server-render safety check is run
- THEN the check fails
- AND it reports a single environment fault that identifies the conflicting runtime copies and how to reconcile them to one
- AND it does not report a separate per-case failure for each affected case
- AND it does not attribute the failure to any component's source

#### Scenario: A genuine per-case render failure is still reported per case

- GIVEN a showcase whose component runtime is shared correctly
- AND one case that touches a browser-only API during render
- WHEN the server-render safety check is run
- THEN that case is reported by its component, case, and source file
- AND no environment fault is reported

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
re-applying it — so no flash of unstyled content and no restyle occurs, and the
surface is not styled twice.

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
