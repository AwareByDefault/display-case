## MODIFIED Requirements

### Requirement: In-app accessibility surfacing

When accessibility surfacing is configured, Display Case SHALL present each
variant's accessibility result on the running browsing surface: a per-variant
marker in the navigation and a verdict beside the rendered variant. When
accessibility surfacing is NOT configured, the browsing surface SHALL be
unchanged — no markers and no verdict surface.

Results SHALL be produced on demand for the variant being viewed, SHALL be
reused without re-scanning while nothing affecting that variant's rendered
output has changed, and SHALL never block the browsing surface or the rendering
of a variant. A variant whose result is not yet available SHALL read as in
progress until it lands. A variant SHALL be evaluated per theme, and the verdict
SHALL reflect the theme currently shown.

When accessibility surfacing is configured, the operator MAY configure how the
navigation's accessibility markers are populated when Display Case starts,
through a start-up population mode with three settings:

- **off** — Display Case SHALL NOT populate any markers at start-up; each
  variant's marker SHALL appear only once that variant is viewed. This SHALL be
  the behavior when no start-up population mode is configured.
- **cached** — at start-up, Display Case SHALL populate the navigation markers
  for every variant that already has a reusable cached result, without running
  any scan. A variant with no cached result, or whose cached result is no longer
  reusable because its rendered output has changed, SHALL remain unmarked until
  it is viewed.
- **refresh** — at start-up, Display Case SHALL evaluate every variant that has
  no reusable cached result — both variants never scanned and variants whose
  cached result is no longer reusable because their rendered output has changed
  — and SHALL surface each variant's verdict in the navigation as it lands,
  while reusing the markers of variants whose cached result is still reusable
  without re-scanning them.

Start-up population in any mode SHALL never block the browsing surface or the
rendering of a variant, and SHALL NOT change the on-demand behavior when a
variant is subsequently viewed.

When accessibility surfacing is configured but its scanning prerequisite is
unavailable, Display Case SHALL still start and browse normally and SHALL
indicate the surface is unavailable rather than reporting a false result; in
this state no start-up population SHALL occur regardless of the configured mode.

#### Scenario: Surfacing not configured

- WHEN Display Case runs without accessibility surfacing configured
- THEN the browsing surface shows no accessibility markers and no verdict surface

#### Scenario: Viewing a variant with violations

- GIVEN accessibility surfacing is configured
- WHEN a variant whose rendered output has accessibility violations is viewed
- THEN its violations are presented beside the rendered variant
- AND the navigation marks that variant as having violations

#### Scenario: Viewing a clean variant

- GIVEN accessibility surfacing is configured
- WHEN a variant whose rendered output has no accessibility violations is viewed
- THEN the verdict reports the variant passes
- AND the navigation shows no violation marker for that variant

#### Scenario: Result not yet available

- GIVEN accessibility surfacing is configured
- WHEN a variant is viewed before its result is available
- THEN the verdict reads as in progress without blocking the rendered variant
- AND the verdict updates in place once the result lands

#### Scenario: Per-theme verdict

- GIVEN a variant that has violations in one theme but not another
- WHEN the shown theme is changed
- THEN the verdict reflects the accessibility result for the shown theme

#### Scenario: Scanning prerequisite unavailable

- GIVEN accessibility surfacing is configured
- AND the scanning prerequisite is unavailable
- WHEN Display Case is started and a variant is viewed
- THEN Display Case browses normally
- AND the surface indicates accessibility results are unavailable rather than reporting a pass or failure

#### Scenario: Start-up population not configured

- GIVEN accessibility surfacing is configured without a start-up population mode
- WHEN Display Case starts
- THEN the navigation shows no accessibility markers until variants are viewed

#### Scenario: Start-up population from cache only

- GIVEN accessibility surfacing is configured with the start-up population mode set to cached
- AND some variants have reusable cached results and others have none
- WHEN Display Case starts
- THEN the navigation is populated with the markers for the variants that have reusable cached results
- AND no scan is run for any variant
- AND the variants without a reusable cached result remain unmarked until viewed

#### Scenario: Start-up population refreshes uncached and stale variants

- GIVEN accessibility surfacing is configured with the start-up population mode set to refresh
- AND some variants have never been scanned, some have a cached result whose rendered output has since changed, and some have a still-reusable cached result
- WHEN Display Case starts
- THEN the never-scanned variants and the stale variants are evaluated and their verdicts surface in the navigation as they land
- AND the variants with a still-reusable cached result are marked without being re-scanned
- AND the browsing surface remains usable while the evaluation proceeds

#### Scenario: Start-up population suppressed when scanning unavailable

- GIVEN accessibility surfacing is configured with the start-up population mode set to refresh
- AND the scanning prerequisite is unavailable
- WHEN Display Case starts
- THEN no variants are evaluated at start-up
- AND the surface indicates accessibility results are unavailable rather than reporting pass or failure
