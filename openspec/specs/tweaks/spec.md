# Tweaks

## Purpose

A case may declare tweaks — named, typed, interactive controls — whose current values are encoded in the case's address so a tweaked state is shareable and reproducible.
## Requirements
### Requirement: Tweaks (interactive controls)

A case MAY declare tweaks — named, typed inputs (at least text, boolean, number, and a fixed-option choice) with default values. When a case declares tweaks, Display Case SHALL present a controls panel that lets a viewer change each tweak's value and SHALL re-render the case with the changed values. The current tweak values SHALL be encoded in the case's address so a tweaked state is shareable and reproduces on reload.

#### Scenario: Adjusting a tweak

- GIVEN a case that declares a tweak with a default value
- WHEN a viewer changes that tweak in the controls panel
- THEN the case re-renders using the new value
- AND the case's address updates to encode the new value

#### Scenario: Reproducing a tweaked state

- GIVEN an address that encodes non-default tweak values for a case
- WHEN a viewer opens that address
- THEN the case renders with those tweak values applied

#### Scenario: A case without tweaks

- GIVEN a case that declares no tweaks
- WHEN a viewer selects it
- THEN it renders normally with no controls panel and no error

### Requirement: Controls panel default placement respects the case's size

While the viewer has not explicitly chosen a placement, Display Case SHALL
choose the controls panel's placement — docked beside the case, or undocked as a
floating overlay — per case, such that the full case remains visible. When a
docked panel would leave the case too tall to fit the available space, the panel
SHALL be placed undocked. When the case fits with the panel docked, the panel
SHALL be placed docked. Selecting a different case SHALL re-evaluate the
placement for that case's size.

A viewer MAY explicitly dock or undock the panel. Once a viewer has made an
explicit choice, that choice SHALL take precedence for the remainder of the
current page load: it SHALL persist across case selections, and the automatic
size-based placement SHALL NOT override it thereafter. The explicit choice SHALL
NOT be persisted; reloading the page SHALL discard it and return to automatic,
per-case, size-based placement.

The panel SHALL be presented already in its resolved placement. It SHALL NOT
visibly transition from one placement to the other as a consequence of the
automatic decision.

The placement SHALL be resolved after the layout can be measured, so the case's
server-rendered output and its first paint are unaffected by the choice.

#### Scenario: A tall case opens the panel undocked

- GIVEN a viewer who has not explicitly chosen a placement
- AND a case that is taller than the space left with the controls panel docked
- WHEN the controls panel is presented for that case
- THEN the panel is placed undocked (floating)
- AND the full case remains visible
- AND the panel does not visibly transition from docked to undocked

#### Scenario: A case that fits keeps the panel docked

- GIVEN a viewer who has not explicitly chosen a placement
- AND a case that fits within the available space with the controls panel docked
- WHEN the controls panel is presented for that case
- THEN the panel is placed docked

#### Scenario: Switching cases re-evaluates placement by size

- GIVEN a viewer who has not explicitly chosen a placement
- AND the panel is currently docked for a case that fits
- WHEN the viewer selects a case that is too tall to fit with the panel docked
- THEN the panel is placed undocked for the newly selected case

#### Scenario: An explicit choice persists across cases

- GIVEN a tall case whose panel was automatically placed undocked
- WHEN the viewer explicitly docks the panel
- THEN the panel stays docked
- AND selecting other cases keeps the panel docked regardless of their size
- AND the automatic size-based placement does not override it

#### Scenario: Reloading discards an explicit choice

- GIVEN a viewer who explicitly docked the panel on a tall case
- WHEN the viewer reloads the page
- THEN the explicit choice is discarded
- AND the panel is placed by size for the shown case (undocked for a tall case)

