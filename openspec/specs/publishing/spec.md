# Publishing

## Purpose

Display Case is a development-only tool excluded from consuming applications, but it can produce its own standalone, deployable build of a showcase.

## Requirements

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

### Requirement: Deployable build

Display Case SHALL provide a command that produces a self-contained, deployable build of a showcase that can be hosted independently of the development server. The build SHALL serve every address — the browsing surface, each isolated case render, and the primer — with its content rendered before scripting, equivalent to what the development server delivers. The build SHALL NOT include development-only behaviors: it SHALL NOT watch for file changes, rebuild on demand, reload connected clients, or expose development-only endpoints. The build SHALL retain a health signal suitable for a host to probe, and SHALL support hosting under a configurable base path. The build's static assets SHALL be addressed so a host MAY cache them indefinitely, while delivered documents SHALL NOT be cached as though unchanging. The build SHALL be reproducible: the same showcase SHALL produce equivalent output. The command MAY additionally produce a fully static form that can be hosted with no running server; when it does, it SHALL make clear that address-encoded variations not pre-rendered as files resolve once the page's scripts run.

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
