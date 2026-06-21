## Why

Developers increasingly run several checkouts of this project side by side — git worktrees for parallel branches, agent isolation, review copies. Display Case previously anchored some of its state to where the tool itself was installed and resolved its target ambiguously between a "no argument" mode and an explicit `.`. The two failure modes that produced: (1) running it from one checkout could read or write another checkout's build cache, so two parallel runs corrupted each other; (2) the bare command's behaviour was hard to reason about under `bunx`, where the install location and the working directory differ. We want one predictable resolution rule and per-checkout isolation, so that N working copies run independently with no shared or clobbered state.

## What Changes

- Display Case **locates the showcase** from an explicit location if given, otherwise by **searching upward from the working location** for a showcase configuration — so it works from the package root or any subdirectory.
- The **bare invocation and `.` are unified** into a single mode; there is no separate "no-argument" behaviour to reason about.
- **All derived state — build caches and recorded artifacts — anchors to the located showcase**, not to where Display Case is installed, so two independent working copies never share or corrupt each other's state.
- An **explicit location with no showcase configuration fails loudly** with a clear message instead of silently serving an empty or unrelated showcase.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `display-case`: defines how the tool locates the showcase to run (explicit location, else upward search) and requires all derived state to be anchored to the located copy, so independent working copies run without colliding.

## Impact

- **Spec**: `openspec/specs/display-case/spec.md` — adds "Locating the showcase to run".
- **Package** `packages/display-case`: target/config resolution and the upward search, the unified bare/`.` form, and anchoring the `.display-case/` build cache to the resolved package (`src/cli.ts`); the per-worktree port hint (`DISPLAY_CASE_PORT`) so two checkouts don't collide on a port.
- **Docs**: `packages/display-case/README.md` documents the single rule — run from inside the checkout, or pass a path explicitly; don't rely on a cwd pointing at a sibling checkout.
- **Consumers**: invocation is backward compatible (`display-case .` still works); the bare form now resolves identically. No production application artifact is affected — Display Case remains development-only.
