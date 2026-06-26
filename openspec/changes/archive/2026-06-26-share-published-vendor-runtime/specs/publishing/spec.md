## ADDED Requirements

### Requirement: Shared runtime delivered once

The deployable build SHALL NOT duplicate runtime code that is common across
surfaces — the rendering runtime every surface depends on — by inlining a separate
copy into each surface's bundle. Such shared code SHALL be delivered as a single
resource that every surface references, so that the total bytes a client downloads
to browse any number of surfaces does not grow by a full copy of that shared code
per surface. The shared resource SHALL be addressed so a host MAY cache it
indefinitely, exactly like the build's other static assets. This SHALL hold for
both a host-served build and a fully static, server-less export, and SHALL NOT
change what any surface renders or the guarantee that each surface's content is
delivered before scripting.

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

#### Scenario: Sharing holds for the static export and preserves pre-scripting content

- GIVEN a deployable build produced in its fully static, server-less form
- WHEN a surface and a case deep link are retrieved
- THEN each still delivers its content before scripting, themed
- AND each references the single shared runtime resource rather than inlining its own copy
