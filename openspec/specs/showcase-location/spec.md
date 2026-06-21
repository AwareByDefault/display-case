# Showcase Location

Display Case determines which showcase to run and anchors all derived state to that showcase so independent working copies do not collide.

## Requirements

### Requirement: Locating the showcase to run

Display Case SHALL determine which showcase to run from an explicitly provided location or, absent one, by searching upward from the working location for a showcase configuration. All state a run derives — its build caches and any recorded artifacts — SHALL be anchored to the located showcase rather than to wherever Display Case itself is installed, so that two independent working copies of the same project can run without sharing or corrupting each other's state. When an explicit location is given that contains no showcase configuration, the run SHALL fail with a clear message rather than guess.

#### Scenario: Running without an explicit location

- GIVEN a working copy that contains a showcase configuration at or above the working location
- WHEN Display Case is started without being told where the showcase is
- THEN it locates that showcase by searching upward from the working location
- AND it runs against it

#### Scenario: Independent working copies do not collide

- GIVEN two independent working copies of the same project
- WHEN Display Case is run from within each
- THEN each run anchors its caches and recorded artifacts to its own working copy
- AND neither run shares or corrupts the other's state

#### Scenario: Explicit location without a showcase

- GIVEN an explicit location that contains no showcase configuration
- WHEN Display Case is started against it
- THEN the run fails with a message identifying that no showcase was found there
- AND it does not fall back to an unrelated location
