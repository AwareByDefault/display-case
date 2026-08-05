## ADDED Requirements

### Requirement: Catalog identifies the rendering substrate

The machine-readable catalog SHALL identify the active rendering substrate and
enumerate its declared variant axes — each axis with its identifier, its
possible values, its default, and whether it selects a different rendering or
only adjusts presentation — so a machine client can enumerate and address
every declared variant of every case without assuming any fixed axis set.

#### Scenario: An agent enumerates variants from the declared axes

- GIVEN a showcase whose substrate declares rendering-selecting variant axes
- WHEN a machine client requests the catalog
- THEN it receives the substrate's identity and its declared axes with their values and defaults
- AND it can construct the address of any case under any declared combination of axis values

#### Scenario: The default substrate declares the familiar axes

- GIVEN a showcase that configures no substrate
- WHEN a machine client requests the catalog
- THEN the declared axes are the light/dark theme axis and the viewport-width axis
