## ADDED Requirements

### Requirement: Showcased component case coverage
Components in a showcased library must each have a colocated case so the component showcase cannot silently drift out of coverage. The lint pipeline SHALL verify that every exported component of a showcased library has a colocated case file. Any exported component without one SHALL cause the pipeline to fail, naming the uncovered component.

#### Scenario: Exported component without a case file fails lint
- WHEN an exported component of a showcased library has no colocated case file
- THEN the lint pipeline SHALL exit with a non-zero status code
- AND the uncovered component SHALL be named in the output

#### Scenario: Full coverage passes lint
- WHEN every exported component of a showcased library has a colocated case file
- THEN the coverage check SHALL pass
