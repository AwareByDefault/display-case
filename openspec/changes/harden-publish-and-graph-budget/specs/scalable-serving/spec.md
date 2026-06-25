## ADDED Requirements

### Requirement: Isolated, crash-contained publishing

Producing a deployable build of a showcase SHALL prepare each surface's bundle in
isolation, so that producing the build never accumulates the combined material of
the whole catalog as one indivisible unit and never accumulates the bundling
machinery's working state across surfaces. Producing the build of a showcase of any
size SHALL NOT terminate the publishing process with a native crash before the
build completes. If preparing one surface's bundle crashes the underlying bundler
(an abnormal termination), the publishing process SHALL contain that crash,
attribute it to the specific surface, fail with a clear diagnostic, and exit
unsuccessfully — it SHALL NOT inherit the crash as a native panic, and SHALL NOT
present an incomplete build as a finished one. This guarantee SHALL hold equally for
every form a published build delivers: the bundles a host-served build serves, the
bundles a fully static (server-less) export embeds, and the renderers used to
produce content before scripting.

#### Scenario: A large showcase publishes without crashing the publisher

- GIVEN a showcase large enough that preparing all of its surfaces' bundles together in one process would crash the underlying bundler
- WHEN the showcase is published
- THEN a standalone, deployable build is produced
- AND the publishing process does not terminate with a native crash
- AND every case is reachable in the published build

#### Scenario: A bundler crash on one surface is contained and attributed

- GIVEN a showcase with one surface whose bundle preparation crashes the underlying bundler
- WHEN the showcase is published
- THEN the publishing process does not terminate with a native panic
- AND it reports which surface crashed the bundler
- AND it exits unsuccessfully without presenting an incomplete build as finished

#### Scenario: Isolation covers host-served, static, and pre-scripting forms

- GIVEN a published build that includes host-served bundles, a fully static export, and renderers that produce content before scripting
- WHEN the build is produced
- THEN each of those forms is prepared through isolated, crash-contained bundling
- AND a crash preparing any one of them is contained and attributed rather than terminating the publisher
