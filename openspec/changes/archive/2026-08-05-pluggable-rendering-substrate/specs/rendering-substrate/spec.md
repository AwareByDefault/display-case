## ADDED Requirements

### Requirement: Configurable rendering substrate with an identical-behavior default

Display Case SHALL let a showcase select, in its configuration, a rendering
substrate — the replaceable part of the pipeline that turns a discovered case
into a viewable rendering, covering headless frame production, frame
serialization, the stage document, an optional client stage runtime,
substrate-appropriate check phases, and the variant axes the showcase varies
over. A showcase SHALL target exactly one substrate. When no substrate is
configured, Display Case SHALL use its default substrate, which renders
browser documents; a showcase that configures no substrate SHALL behave
identically to Display Case before substrates existed — the same addresses,
the same delivered documents, the same check results, and the same published
output.

#### Scenario: No substrate configured

- GIVEN a showcase whose configuration selects no substrate
- WHEN the showcase is browsed, checked, and published
- THEN every delivered surface, check result, and published artifact is identical to the pre-substrate behavior

#### Scenario: A configured substrate replaces the rendering

- GIVEN a showcase whose configuration selects a non-default substrate
- WHEN a case is rendered
- THEN the rendering is produced by the configured substrate
- AND the browsing chrome around the stage is unchanged

### Requirement: Headless frame rendering and serialization

The active substrate SHALL be able to render any case headlessly — outside a
browser, with no interactive client — into a frame, honoring the case's tweak
values and the rendering-selecting variant values requested for it, and SHALL
serialize a frame into bytes in a format the substrate declares, including
the file extension under which such bytes are stored. For a case that renders
deterministically, repeated headless renders of the same case, variant
values, and tweak values SHALL serialize to the same bytes.

#### Scenario: A case renders headlessly

- GIVEN a showcase with a discovered case
- WHEN the active substrate renders that case headlessly
- THEN a frame is produced without a browser or interactive client
- AND the frame reflects the requested variant and tweak values

#### Scenario: Serialization is deterministic

- GIVEN a case that renders deterministically
- WHEN the same case is rendered headlessly twice with the same variant and tweak values
- THEN both renders serialize to the same bytes

### Requirement: The substrate owns the stage document

The document served at a case's isolated render address SHALL be produced
entirely by the active substrate, including its presentation envelope (fonts,
background, sizing, and any theming signals), so a substrate for a non-browser
medium can present its frames appropriately without inheriting another
medium's document conventions.

#### Scenario: A non-default substrate controls its whole document

- GIVEN a showcase whose substrate presents frames in its own document envelope
- WHEN a client retrieves a case's isolated rendering
- THEN the delivered document is the one the substrate produced
- AND no presentation convention of the default substrate is imposed on it

### Requirement: Substrate-declared variant axes

The active substrate SHALL declare the axes its renderings vary over — each
axis with an identifier, the values it can take, and a default — and SHALL
distinguish axes that select a different rendering (encoded in the case's
address and honored by the headless render) from axes that only adjust the
stage's presentation around an unchanged rendering. The browsing surface's
variant controls, the catalog, the render addresses, and the checks' variant
enumeration SHALL follow the declared axes rather than any fixed set. The
default substrate SHALL declare the light/dark theme axis as a
rendering-selecting axis and the viewport-width axis as a presentation axis,
with their existing behavior.

#### Scenario: Variant enumeration follows the declared axes

- GIVEN a showcase whose substrate declares rendering-selecting axes other than theme
- WHEN the checks enumerate the variants to evaluate
- THEN each declared combination of rendering-selecting axis values is enumerated
- AND no fixed light/dark assumption is applied

#### Scenario: An address-encoded axis value selects the rendering

- GIVEN a substrate axis declared as rendering-selecting
- WHEN a case's address carries a value for that axis
- THEN the headless render honors that value
- AND the delivered rendering reflects it

#### Scenario: The default substrate declares today's axes

- GIVEN a showcase that configures no substrate
- WHEN its declared axes are read
- THEN they are the light/dark theme axis and the viewport-width axis with their existing behavior

### Requirement: Substrate-delegated check phases

The render-dependent check phases — render safety, accessibility audit,
visual capture and comparison, and token conformance — SHALL be supplied by
the active substrate, and the default substrate SHALL supply the existing
behaviors for each. A phase the active substrate does not supply SHALL be
reported as not applicable for that substrate and SHALL NOT fail the run on
that account. A consumer-configured override of the comparison mechanism SHALL
take precedence over the substrate's default (see Visual-Regression Checks).

The accessibility and visual phases SHALL both read a single opened variant,
so that the audit and the capture describe the same rendering, and so that
evaluating a variant under both phases costs one rendering rather than two.
Opening a variant SHALL yield the captured bytes, the accessibility result, and
the format the captured bytes are in; whatever the opened variant holds SHALL
be released once both phases have read it. A substrate that cannot open a
variant SHALL have both phases reported as not applicable.

#### Scenario: A substrate-supplied phase is used

- GIVEN a showcase whose substrate supplies its own accessibility audit
- WHEN the accessibility checks run
- THEN the substrate's audit evaluates each variant
- AND the default substrate's audit is not invoked

#### Scenario: Both render phases read one opened variant

- GIVEN a run that requests both the accessibility and the visual phase
- WHEN a variant is evaluated
- THEN the variant is opened once and both phases read that same rendering
- AND what the opened variant held is released afterwards

#### Scenario: The capture format follows the capture, not the serialization

- GIVEN a substrate whose captured bytes are in a different format from its serialized frames
- WHEN a baseline is recorded for a variant
- THEN the baseline is stored in the captured format under that format's extension

#### Scenario: An unsupplied phase is reported inapplicable

- GIVEN a showcase whose substrate supplies no token-conformance phase
- WHEN that phase is requested
- THEN the run reports the phase as not applicable for the substrate
- AND the run does not fail on that account

#### Scenario: A consumer override wins over the substrate default

- GIVEN a showcase whose configuration overrides the comparison mechanism
- WHEN the visual check runs
- THEN the consumer's mechanism decides whether each case differs
- AND the substrate's default comparison is not invoked

### Requirement: Substrates are implementable out-of-tree

A substrate SHALL be implementable outside Display Case's own codebase
against a stable, documented public surface covering the authoring model,
case discovery, the catalog, and case-tree construction, without depending on
undocumented internals. A substrate so implemented and selected in a
showcase's configuration SHALL be a complete substrate — nothing available to
the built-in default SHALL be required that the public surface does not
offer.

#### Scenario: An out-of-tree substrate is selected

- GIVEN a substrate implemented outside Display Case against the public surface only
- WHEN a showcase's configuration selects it
- THEN the showcase browses, checks, and publishes through that substrate
- AND no undocumented internal access is required

### Requirement: Serialized frame retrieval without a server

Display Case SHALL provide a way to obtain a case's serialized frame directly
— without a running showcase server and without a browser — honoring
requested rendering-selecting variant values and tweak values, so a machine
client can capture a case's rendering as data it reads directly.

#### Scenario: An agent captures a frame directly

- GIVEN a showcase whose substrate serializes frames to a readable text form
- WHEN a machine client requests a case's serialized frame directly
- THEN it receives the frame bytes without a server or browser being started
- AND the frame reflects the requested variant and tweak values

### Requirement: A substrate without a client stage runtime is complete

A substrate MAY supply no client stage runtime, in which case every frame is
static. Such a substrate SHALL still support the full browsing surface:
selecting cases, switching declared variant values, adjusting tweaks,
stepping flows, and deep linking SHALL each present the correct frame by
producing a new rendering for the new address, and no capability of the
substrate contract SHALL require a client runtime to exist.

#### Scenario: Tweaks work on static frames

- GIVEN a showcase whose substrate supplies no client stage runtime
- WHEN a viewer adjusts a tweak value
- THEN the stage presents a newly rendered frame reflecting the adjusted value
- AND the tweak controls, addressing, and sharing behave as for any other showcase
