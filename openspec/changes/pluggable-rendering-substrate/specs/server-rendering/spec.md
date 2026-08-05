## MODIFIED Requirements

### Requirement: Pre-scripting rendered content

Display Case SHALL deliver each browsing surface, isolated case render, and primer as a document whose content is already rendered — laid out and presented for the requested variant values (under the default substrate, the requested theme) — before any of the page's own scripts execute. A client that retrieves such an address and does not execute its scripts SHALL still receive that address's content, not an empty shell. The styling required to present that content as it appears once the surface is interactive SHALL itself be delivered before scripting: a surface retrieved without executing scripts SHALL appear in its styled form, not merely structurally present, and SHALL NOT restyle once the page's scripts run. For a browsing surface, the content present before scripting SHALL include the component catalog and the selected case's framing, and the catalog needed for that first paint SHALL be embedded in the delivered document so no separate catalog request is required before content appears. Interactive behaviors of those surfaces (variant switching, tweak controls, catalog navigation, primer navigation) MAY depend on the page's scripts, but the initial rendered content and its styling SHALL NOT. The content delivered before scripting SHALL be the same content the surface produces once interactive, so that variants, snapshots, and addresses are unchanged.

The pre-scripting content of an isolated case render SHALL be the frame the
active substrate produced headlessly. When a substrate's frames are painted by
a client stage runtime, the frame itself SHALL still be fully computed
server-side and delivered in the document — only the painting of the delivered
frame MAY depend on the page's scripts.

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

#### Scenario: A stage-runtime-painted frame is delivered in the document

- GIVEN a showcase whose substrate paints frames with a client stage runtime
- WHEN a client retrieves a case's isolated rendering and does not execute the page's scripts
- THEN the delivered document already contains the fully computed frame
- AND only the painting of that frame awaits the page's scripts

#### Scenario: A case that cannot render outside a browser

- GIVEN a case that requires a browser to render
- WHEN its surface is delivered
- THEN the surrounding surface's content is still present before scripting
- AND that case renders once the page's scripts run
- AND the surface does not error

#### Scenario: Interactivity layered on after content

- GIVEN a surface whose initial content was delivered before scripting
- WHEN the page's scripts run and a viewer switches a variant value, adjusts a tweak, or navigates the catalog or primer
- THEN the surface responds to the interaction as before
- AND the initial content was usable prior to that interaction

### Requirement: Server-render safety check

Display Case SHALL provide a check that verifies every case can be rendered headlessly — before scripting, outside a browser — under the active substrate, and SHALL fail when a case cannot — except for a case whose component is declared to require the client environment (a browser, under the default substrate). A case file MAY declare a component as requiring the client; such a component SHALL be exempt from this check and SHALL be rendered in the client wherever it appears, rather than failing or blanking the surrounding surface. The check SHALL identify each failing case by its component, case, and source file, and SHALL be runnable on its own without rendering in a browser. The rendering the check exercises SHALL be the active substrate's headless render, so the check verifies exactly what the isolated render will deliver.

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

#### Scenario: The check exercises the active substrate's render

- GIVEN a showcase whose substrate renders to a non-browser medium
- WHEN the server-render safety check is run
- THEN each case is rendered headlessly through that substrate
- AND a case that throws under that render is reported by its component, case, and source file

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
