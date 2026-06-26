## MODIFIED Requirements

### Requirement: Shared runtime delivered once

The deployable build SHALL NOT duplicate runtime code that is shared across
surfaces — the rendering runtime every surface depends on, together with any further
library an author declares shared (see Author-declared shared libraries) — by
inlining a separate copy into each surface's bundle. Such shared code SHALL be
delivered as one resource per shared library that every surface references, so that
the total bytes a client downloads to browse any number of surfaces does not grow by
a full copy of that shared code per surface. Each shared resource SHALL be addressed
so a host MAY cache it indefinitely, exactly like the build's other static assets,
and SHALL be re-addressed when its content changes so a stale copy is never served.
This SHALL hold whether a shared library is published independently of the showcase
or defined within the same repository as it. It SHALL hold for both a host-served
build and a fully static, server-less export, and SHALL NOT change what any surface
renders or the guarantee that each surface's content is delivered before scripting.

#### Scenario: Browsing many surfaces downloads the shared runtime once

- GIVEN a published build of a showcase with many components
- WHEN a client browses several of the isolated surfaces in turn
- THEN the runtime common to those surfaces is downloaded once and reused across them
- AND no surface's own bundle contains its own separate copy of that shared runtime

#### Scenario: The shared runtime is a cacheable asset

- GIVEN a published build
- WHEN it is hosted
- THEN the shared runtime is served as a content-addressed asset a host may cache indefinitely
- AND each surface references that one resource rather than embedding it

#### Scenario: A shared library defined in the same repository is delivered once

- GIVEN a showcase whose components share a library defined within the same repository as the showcase
- WHEN the build is produced and a client browses several surfaces that use it
- THEN that library is delivered once as a shared resource the surfaces reference
- AND no surface's own bundle contains its own separate copy of it

#### Scenario: A shared resource is re-addressed when its content changes

- GIVEN a published build whose shared resource is served at a content-derived address
- WHEN the shared library's content changes and the showcase is published again
- THEN the shared resource is served at a different address
- AND a client is not served a stale copy from the previous address

#### Scenario: Sharing holds for the static export and preserves pre-scripting content

- GIVEN a deployable build produced in its fully static, server-less form
- WHEN a surface and a case deep link are retrieved
- THEN each still delivers its content before scripting, themed
- AND each references the single shared runtime resource rather than inlining its own copy

## ADDED Requirements

### Requirement: Author-declared shared libraries

The build SHALL let an author declare, in the showcase's configuration, runtime
libraries — beyond the rendering runtime that is always shared — to be delivered once
across the published build's surfaces. An author MAY declare zero or more such
libraries. For each declared library the build SHALL deliver it as a single shared
resource that every surface references rather than inlining a copy per surface (per
Shared runtime delivered once), and SHALL route every surface's use of
that library to that one shared instance, so that a library that requires a single
instance to behave correctly is not split into multiple instances across surfaces. A
use of a declared library that the build cannot route to the shared resource SHALL
still render correctly, falling back to an inlined copy rather than failing the build
or the surface. Declaring a library shared SHALL NOT change what any surface renders.
With no library declared, the build's output SHALL be equivalent to delivering only
the always-shared rendering runtime.

#### Scenario: Declaring a library to share

- GIVEN a showcase whose configuration declares a runtime library to be shared
- WHEN the deployable build is produced and a client browses several surfaces that use it
- THEN that library is delivered once as a shared resource the surfaces reference
- AND no surface's own bundle contains its own separate copy of it

#### Scenario: A single-instance library behaves correctly when shared

- GIVEN a declared shared library that must exist as a single instance to behave correctly
- WHEN surfaces that use it are rendered in the published build
- THEN every surface resolves its use of the library to the one shared instance
- AND the library behaves as it would with a single instance, not as multiple split instances

#### Scenario: An unrouteable use still renders

- GIVEN a surface whose use of a declared shared library the build cannot route to the shared resource
- WHEN that surface is delivered
- THEN the surface still renders its content correctly
- AND the build does not fail on account of the unrouteable use

#### Scenario: No declared libraries leaves output unchanged

- GIVEN a showcase that declares no additional shared libraries
- WHEN the deployable build is produced
- THEN its output is equivalent to delivering only the always-shared rendering runtime

### Requirement: Reporting duplicated runtime

When producing a deployable build, Display Case SHALL report runtime libraries that
it inlined into more than one surface's bundle and that are therefore candidates for
being shared, identifying each such library and the extent of its duplication, so an
author can decide to declare it shared. This reporting SHALL NOT change the build's
output and SHALL NOT fail the build.

#### Scenario: Reporting duplication candidates

- GIVEN a published build in which a runtime library is inlined into more than one surface's bundle
- WHEN the build is produced
- THEN the build reports that library as a candidate for sharing
- AND the report identifies the library and the extent of its duplication

#### Scenario: Reporting does not alter the build

- GIVEN a published build that reports duplication candidates
- WHEN the build is produced
- THEN the reported candidates are not shared unless the author declares them
- AND the report neither changes the delivered output nor fails the build
