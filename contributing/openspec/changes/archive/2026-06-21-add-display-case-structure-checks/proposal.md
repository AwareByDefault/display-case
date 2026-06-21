## Why

Display Case rewards good authoring habits — a case and a prompt doc per component, a declared hierarchy level, a placard, a working snapshot toolchain — but nothing enforces them. A consumer can drift out of these conventions silently: components with no prompt doc, prompt docs orphaned from any case, cases that fall into the unclassified bucket, a placard that is configured but empty, or a checkout where the visual checks cannot run at all. The only guard today is a repo-local lint that checks one thing (a missing `.case.tsx`) for this repository alone — it does not ship with the package, so other consumers get nothing. Display Case should be able to check adherence to its own best practices, for any consumer, as a first-class part of its check command.

## What Changes

- Add a new **structure** check phase to Display Case's check command — a static, browser-free phase that validates a showcase against Display Case best practices, runnable on its own or as part of the full check run.
- The structure phase comprises independently configurable **rules**, each of which can be disabled in the showcase configuration, in three groups:
  - **File / config rules** (default on):
    - **Case + prompt coverage** — every component a showcase declares as showcasable has both a colocated case and a colocated usage-documentation (prompt) doc, unless that component is explicitly exempted.
    - **No orphaned prompt docs** — every usage-documentation doc has a colocated case; a doc with no case is reported (a component source file is not required).
    - **Placard present and used** — a placard is configured and exists, its embedded specimens use the required specimen contract, and it is not effectively empty.
    - **Setup present** — the showcase can actually run its render-based checks: either the default snapshot toolchain is available or custom snapshot mechanisms are configured.
    - **Config paths exist** — files the configuration references (global styles, baseline location) exist.
  - **Catalog-integrity rules** (default on):
    - **Levels classified** — every discovered case declares a hierarchy level that is one of the named levels (never the unclassified bucket).
    - **Cases load** — every discovered case file loads; a malformed case file is reported as a gated finding.
    - **Flow integrity** — every flow has more than one step, and each step transition names an existing step.
    - **Unique addressing** — no two components, or two cases within a component, collide on their address slug.
    - **Valid tweak defaults** — a choice tweak's default is one of its declared options.
  - **Composition (import-graph) rules** (opt-in, default off): **atom purity** (an atom imports no other showcased component), **no downward dependency** (no component imports a higher-level component), **composes a lower level** (a non-atom imports at least one lower-level showcased component — an organism built only of atoms is valid), and **level fit** (advisory: a component composing more lower-level parts than recommended is a hint to promote it) — with cross-package level resolution for components imported from another showcase in the same workspace.
- Give every finding a **severity** (`warn` or `error`): only errors fail the run; warnings are reported but non-fatal. Each rule has a default severity (high-confidence rules `error`, heuristic rules `warn`) and is retunable in configuration; a strict mode escalates all warnings to errors for CI that wants zero warnings.
- Make each check phase's participation in the **default (no-phase-named) run configurable** — a showcase can opt any phase, including the existing accessibility, visual-regression, and token phases, out of the default run while still being able to invoke it explicitly.
- Provide a **per-target ignore escape hatch** for structure findings, consistent with the existing repository convention, so a deliberately non-conforming file or case can be exempted with a stated reason.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `display-case`: adds the structure check phase and its configurable rules; adds configurability of which phases run in the default check run.

## Impact

- **Capability spec**: `openspec/specs/display-case/spec.md` gains requirements for the structure phase, its rules, default-run configurability, and the ignore escape hatch.
- **Package code**: `packages/display-case` — the check command/runner (`src/cli.ts`, `src/check.ts`), a new structure-check module, and the configuration type (`src/index.ts`, `DisplayCaseConfig`).
- **Package docs**: `packages/display-case/docs/cli.md` and `testing.md`, the README check table, and the agent guide.
- **Repo lint**: the repo-local `tools/lint` `display-case-coverage` check becomes redundant with (a subset of) the new package check and can delegate to or be superseded by it.
- **Dependencies**: none new — the structure phase is static and reuses existing discovery, config resolution, and catalog code.
