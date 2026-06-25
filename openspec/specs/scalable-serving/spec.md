# scalable-serving Specification

## Purpose
TBD - created by archiving change per-case-on-demand-bundling. Update Purpose after archive.
## Requirements
### Requirement: Size-independent preparation

Display Case SHALL prepare and deliver a showcase regardless of how many cases it
contains or how much application code each case transitively imports. Growing the
catalog — adding cases, or cases that pull in substantial application code and
large vendor libraries — SHALL NOT prevent the showcase from starting, serving, or
being published, and SHALL NOT terminate the tool process. Whether the showcase
can be prepared at all SHALL NOT depend on the combined size of all cases taken
together: the preparation of the showcase SHALL NOT require holding every case's
combined material as one indivisible unit. Starting and serving a showcase of any
size SHALL keep the tool process running even when producing some surface's bundle
would crash the underlying bundler.

#### Scenario: A large showcase starts and serves

- GIVEN a showcase with many cases that each transitively import substantial application and vendor code
- WHEN the showcase is run
- THEN it starts and begins serving
- AND every case is reachable at its stable address

#### Scenario: A large showcase publishes

- GIVEN that same large showcase
- WHEN it is published
- THEN a standalone, deployable build is produced
- AND every case is reachable in the published build

#### Scenario: Adding heavy cases does not break a working showcase

- GIVEN a showcase that starts and serves
- WHEN more cases that each import substantial application and vendor code are added
- THEN the showcase still starts and serves
- AND it does not fail to prepare because of the larger catalog

#### Scenario: Starting a very large showcase does not crash the tool

- GIVEN a showcase large enough that bundling it the way the running tool previously did would crash the underlying bundler
- WHEN the showcase is run
- THEN the tool process keeps running and begins serving
- AND the tool does not terminate with a native crash before it serves

### Requirement: On-demand case preparation

The running showcase SHALL begin serving before it has prepared every case, and
SHALL prepare a case's isolated rendering when that case is first requested
rather than ahead of all requests. A case that has not yet been requested SHALL
still be enumerable in the catalog and reachable by its stable address. Once a
case has been prepared, the showcase SHALL serve it without re-preparing it
until its inputs change. This SHALL NOT alter the delivered result: an on-demand
prepared surface SHALL still be rendered before scripting, themed, and addressed
exactly as if it had been prepared ahead of time.

#### Scenario: Serving begins before every case is prepared

- GIVEN a showcase with many cases
- WHEN the showcase is run
- THEN the browsing surface and its component catalog are served without first preparing every case

#### Scenario: First request prepares the case

- GIVEN a running showcase with a case that has not yet been requested
- WHEN a viewer opens that case's stable address
- THEN the case is prepared
- AND its rendered content is delivered, themed for the requested theme, before scripting

#### Scenario: An unrequested case is still enumerable

- GIVEN a running showcase with a case that has never been requested
- WHEN the machine-readable catalog or manifest is read
- THEN that case appears in it
- AND it is reachable at its stable address

#### Scenario: A prepared case is reused until its inputs change

- GIVEN a case that has already been prepared and served
- WHEN it is requested again without any change to its source or dependencies
- THEN it is served without being prepared again

### Requirement: Isolated, diagnosed preparation failure

Display Case SHALL confine a failure to prepare any single surface — the browse
chrome, the primer, or a case — to that surface, whether the failure is a logical
build error (its module graph cannot be bundled) or an abnormal termination of the
underlying bundler (a crash while bundling that surface's graph). When preparing a
surface fails for either reason, the tool process SHALL keep running, every other
surface that can be prepared SHALL still be served, and the failure SHALL be
reported in a form that identifies the offending surface — for a case, its
component, case, and source file — rather than blanking the surface, terminating
the tool, or surfacing an undiagnosable native crash.

#### Scenario: One unpreparable case does not sink the showcase

- GIVEN a showcase in which one case cannot be prepared
- WHEN the showcase is run
- THEN every other case remains browsable and is served
- AND the failing case is reported by its component, case, and source file

#### Scenario: A case that cannot be bundled is diagnosed, not blank

- GIVEN a case whose preparation fails because its module graph cannot be bundled
- WHEN that case is requested
- THEN the failure is attributed to that case by its component, case, and source file
- AND the showcase reports it rather than blanking without explanation

#### Scenario: A bundler crash while preparing a case is contained and attributed

- GIVEN a case whose module graph crashes the underlying bundler when it is bundled
- WHEN that case is requested
- THEN the tool process keeps running and continues serving every other case
- AND the crash is reported as a bundler crash attributed to that case by its component, case, and source file

#### Scenario: A bundler crash while preparing the chrome is reported, not fatal

- GIVEN a showcase whose chrome or initial bundle crashes the underlying bundler when it is built
- WHEN the showcase is run
- THEN the tool process keeps running and reports the bundler crash
- AND it does not terminate with a bare native panic

#### Scenario: A failing case does not block a valid case

- GIVEN a showcase containing one case that cannot be prepared and other valid cases
- WHEN a viewer opens a valid case's stable address
- THEN that case is prepared and rendered normally

