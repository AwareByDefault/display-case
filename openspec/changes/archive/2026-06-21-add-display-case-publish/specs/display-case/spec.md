## MODIFIED Requirements

### Requirement: Pre-scripting rendered content

Display Case SHALL deliver each browsing surface, isolated case render, and placard as a document whose content is already rendered — laid out and themed for the requested theme — before any of the page's own scripts execute. A client that retrieves such an address and does not execute its scripts SHALL still receive that address's content, not an empty shell. For a browsing surface, the content present before scripting SHALL include the component catalog and the selected case's framing, and the catalog needed for that first paint SHALL be embedded in the delivered document so no separate catalog request is required before content appears. Interactive behaviors of those surfaces (theme switching, viewport changes, tweak controls, catalog navigation, placard navigation) MAY depend on the page's scripts, but the initial rendered content SHALL NOT. The content delivered before scripting SHALL be the same content the surface produces once interactive, so that themes, snapshots, and addresses are unchanged.

When a case cannot be rendered outside a browser, Display Case SHALL still present that case by rendering it in the client, and SHALL NOT let that case prevent the surrounding surface from delivering its content before scripting.

#### Scenario: Content present without executing scripts

- GIVEN a case that exists in the catalog
- WHEN a client retrieves that case's isolated rendering and does not execute the page's scripts
- THEN the delivered document already contains the case content
- AND the content is styled for the requested theme

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
- WHEN the page's scripts run and a viewer switches theme, changes the viewport width, adjusts a tweak, or navigates the catalog or placard
- THEN the surface responds to the interaction as before
- AND the initial content was usable prior to that interaction

### Requirement: Development-only tool

Display Case SHALL NOT be included in any consuming application's deployed artifact, and SHALL NOT be required for any consuming application to build or run. Display Case MAY produce its own standalone, deployable build of a showcase (see Deployable build); that build is a separate artifact that a team deploys on purpose and does not form part of any consuming application.

#### Scenario: Application build excludes Display Case

- GIVEN the production build of any consuming application in the repository
- WHEN the build is produced
- THEN it does not include Display Case
- AND the application builds and runs without Display Case present

#### Scenario: A published showcase is a separate artifact

- GIVEN a published, deployable build of a showcase
- WHEN a consuming application is built
- THEN the application's artifact still excludes Display Case
- AND the published showcase is an independent artifact, not part of the application

## ADDED Requirements

### Requirement: Deployable build

Display Case SHALL provide a command that produces a self-contained, deployable build of a showcase that can be hosted independently of the development server. The build SHALL serve every address — the browsing surface, each isolated case render, and the placard — with its content rendered before scripting, equivalent to what the development server delivers. The build SHALL NOT include development-only behaviors: it SHALL NOT watch for file changes, rebuild on demand, reload connected clients, or expose development-only endpoints. The build SHALL retain a health signal suitable for a host to probe, and SHALL support hosting under a configurable base path. The build's static assets SHALL be addressed so a host MAY cache them indefinitely, while delivered documents SHALL NOT be cached as though unchanging. The build SHALL be reproducible: the same showcase SHALL produce equivalent output. The command MAY additionally produce a fully static form that can be hosted with no running server; when it does, it SHALL make clear that address-encoded variations not pre-rendered as files resolve once the page's scripts run.

#### Scenario: Producing a deployable build

- GIVEN a showcase
- WHEN the publish command is run
- THEN it produces a self-contained build that can be hosted independently of the development server
- AND the build runs without the development server's watching or rebuilding

#### Scenario: The deployable build serves pre-scripting content

- GIVEN a hosted deployable build
- WHEN a client retrieves any address and does not execute the page's scripts
- THEN the delivered document already contains that address's content, themed
- AND it is equivalent to what the development server delivers for that address

#### Scenario: The deployable build omits development behaviors

- GIVEN a hosted deployable build
- WHEN it is exercised
- THEN it does not watch for changes, rebuild, reload connected clients, or expose development-only endpoints
- AND its static assets are marked cacheable while its documents are not served as unchanging

#### Scenario: Static form hosted without a running server

- GIVEN a deployable build produced in its fully static form
- WHEN it is hosted by a plain static file host with no running application server
- THEN the browsing surface and a case deep link each deliver their content before scripting
- AND an address-encoded variation that was not pre-rendered as a file resolves once the page's scripts run
