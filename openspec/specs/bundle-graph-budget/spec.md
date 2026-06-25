# bundle-graph-budget Specification

## Purpose
TBD - created by archiving change harden-publish-and-graph-budget. Update Purpose after archive.
## Requirements
### Requirement: Bundle-graph budget check

Display Case SHALL provide a check that reports, for each component, the size of the
module graph its isolated rendering actually pulls in, and SHALL warn the author
when that graph is large enough to risk destabilizing bundling. The check SHALL warn
when a component's total module count exceeds a configured budget, and SHALL
separately warn when a single dependency contributes a disproportionate share of the
graph — the signature of importing an entire barrel of a dependency rather than only
the parts used — naming that dependency and how many modules it contributes. Warnings
SHALL be advisory by default and SHALL be treated as failures when the check is run
in strict mode. The budgets SHALL be configurable, and SHALL have sensible defaults
when unconfigured. The check SHALL measure the graph the bundler actually loads
rather than an estimate, and measuring it SHALL NOT itself be able to terminate the
tool: a component whose isolated preparation crashes the underlying bundler SHALL be
reported as a failure attributed to that component, not inherited as a native crash.
The check SHALL be available on its own and SHALL be part of a full check run, but
SHALL NOT be part of the fast pre-commit set of static checks (because measuring a
real graph prepares each component).

#### Scenario: A component within budget produces no warning

- GIVEN a component whose module graph is within the configured budget and has no single dependency over the per-dependency budget
- WHEN the budget check runs
- THEN it reports the component's module total
- AND it emits no warning for that component

#### Scenario: An oversized graph warns

- GIVEN a component whose module graph exceeds the configured total budget
- WHEN the budget check runs
- THEN it warns that the component exceeds the budget
- AND in strict mode the check fails

#### Scenario: A barrel import is named

- GIVEN a component that imports an entire barrel of a dependency, so that one dependency contributes more modules than the per-dependency budget
- WHEN the budget check runs
- THEN it warns and names that dependency and the number of modules it contributes
- AND it suggests importing only what is used

#### Scenario: Configurable budgets with defaults

- GIVEN a configuration that sets the total and per-dependency budgets
- WHEN the budget check runs
- THEN it uses the configured budgets
- AND when no budgets are configured it uses its built-in defaults

#### Scenario: A component that crashes the bundler is contained

- GIVEN a component whose isolated preparation crashes the underlying bundler
- WHEN the budget check runs
- THEN the check reports a failure attributed to that component
- AND the tool process does not terminate with a native crash

