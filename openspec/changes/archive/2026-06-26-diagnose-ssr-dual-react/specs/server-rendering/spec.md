## MODIFIED Requirements

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
