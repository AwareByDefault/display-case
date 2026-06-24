# change-scoped-checks Specification

## Purpose
TBD - created by archiving change add-change-scoped-checks. Update Purpose after archive.
## Requirements
### Requirement: Gating render checks can be scoped to selected components

The gating render checks (accessibility and visual-regression) SHALL accept an
optional component scope and, when given one, run against only the components in
that scope; with no scope they SHALL run against every component as before. The
scope SHALL be selectable explicitly by component identity (exact or pattern).
The non-render checks SHALL be unaffected by the scope.

#### Scenario: An explicit scope limits the run

- GIVEN a showcase with many components
- WHEN the render checks are run scoped to a named subset of components
- THEN only the named components are rendered and audited
- AND the components outside the scope are not rendered

#### Scenario: No scope checks everything

- GIVEN a showcase with many components
- WHEN the render checks are run without a scope
- THEN every component is rendered and audited

### Requirement: Scope can be derived from the files a change touched

The render checks SHALL be able to derive the component scope from the set of
files changed since a given base revision. A component SHALL be in scope when a
changed file belongs to that component's render inputs — the file defining its
cases, the component it exercises, and everything those reference transitively,
including stylesheets.

#### Scenario: A component-local change scopes to that component

- GIVEN a change that edits only one component's own source
- WHEN the render checks are run scoped to that change
- THEN only that component is rendered and audited

#### Scenario: A shared dependency scopes to every dependent

- GIVEN a change that edits a module several components reference transitively
- WHEN the render checks are run scoped to that change
- THEN every component that references the changed module is in scope

### Requirement: An unattributable render-input change scopes to all components

The derived scope SHALL include every component when a change touches a file that
affects rendering but cannot be attributed to any single component's render
inputs — a globally-applied stylesheet, the shared rendering pipeline, or other
shared source — so a regression is never silently skipped.

#### Scenario: A globally-applied style change

- GIVEN a change to a stylesheet that is applied to every rendered component
- WHEN the render checks are run scoped to that change
- THEN every component is in scope

### Requirement: A change with no render inputs scopes to nothing

The derived scope SHALL be empty — and the render checks SHALL report success
without rendering any component — when a change touches no file that can affect a
rendered component, for example documentation, specifications, tests, or build
and automation tooling.

#### Scenario: A documentation-only change

- GIVEN a change that edits only documentation and test files
- WHEN the render checks are run scoped to that change
- THEN no component is rendered
- AND the render checks report success

### Requirement: Scope selectors compose by intersection

The effective scope SHALL be the intersection of the explicit and change-derived
scopes when both are supplied — a component is checked only when it is both named
and affected by the change.

#### Scenario: Both selectors supplied

- GIVEN an explicit scope naming some components
- AND a change-derived scope affecting an overlapping but different set
- WHEN the render checks are run with both selectors
- THEN only components present in both selections are rendered and audited

