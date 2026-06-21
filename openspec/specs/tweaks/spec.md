# Tweaks

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
