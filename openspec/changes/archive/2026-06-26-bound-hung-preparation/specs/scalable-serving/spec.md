## MODIFIED Requirements

### Requirement: Isolated, diagnosed preparation failure

Display Case SHALL confine a failure to prepare any single surface — the browse
chrome, the primer, or a case — to that surface, whether the failure is a logical
build error (its module graph cannot be bundled), an abnormal termination of the
underlying bundler (a crash while bundling that surface's graph), or a preparation
that neither completes nor crashes within a bounded time (a hang). When preparing a
surface fails for any of these reasons, the tool process SHALL keep running, every
other surface that can be prepared SHALL still be served, and the failure SHALL be
reported in a form that identifies the offending surface — for a case, its
component, case, and source file — rather than blanking the surface, terminating
the tool, or surfacing an undiagnosable native crash. A preparation that exceeds the
bound SHALL be abandoned — the work it is running terminated and any bounded
preparation resource it holds released — so that one surface's preparation cannot
indefinitely block the preparation of other surfaces. The bound SHALL be generous
enough that a legitimately large preparation is not abandoned mid-work, and SHALL be
configurable.

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

#### Scenario: A preparation that hangs is bounded and diagnosed

- GIVEN a surface whose preparation neither completes nor crashes within the bound (it hangs)
- WHEN it is prepared
- THEN after the bound the preparation is abandoned and the work it is running is terminated
- AND the failure is attributed to that surface and reported, distinct from a bundler crash
- AND the bounded preparation resource it held is released so other surfaces can still be prepared
- AND the tool process keeps running and continues serving every other surface
