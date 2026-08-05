## ADDED Requirements

### Requirement: Stage embed contract

The browsing surface SHALL present the rendered case by embedding the case's
isolated rendering at its stable address, and SHALL interact with the embedded
stage only through that address and a defined message protocol — requesting a
render, learning the stage is ready, and being notified of flow-step changes.
The chrome SHALL NOT depend on the internal structure of the stage document,
so any substrate that honors the address shape and the message protocol works
under the unchanged chrome.

#### Scenario: The chrome drives the stage through the contract only

- GIVEN a case rendered in the preview area
- WHEN the viewer changes the selection, a variant value, or a tweak
- THEN the chrome updates the stage through the stage's address and the message protocol
- AND the chrome does not reach into the stage document's content

#### Scenario: A substrate swap leaves the chrome functional

- GIVEN a showcase whose substrate produces a stage document unlike the default substrate's
- WHEN a viewer browses, deep-links, tweaks, and steps flows
- THEN the sidebar, controls, documentation panel, and addressing all function unchanged
- AND only what paints inside the stage differs
