## Why

Display Case is designed to be AI-friendly (a machine-readable manifest, deterministic chrome-free render URLs), but a repo only *becomes* AI-native after manual wiring: an operator must hand-add a launch entry, teach the agent the manifest→render→snapshot loop, and there are no reusable skills encoding that loop. The current agent guide also under-specifies operation (how to start the server, how to rasterize the `/render` HTML), and the promised tool-level `.prompt.md` was never written. The result is that each consuming repo re-discovers how to drive the tool. A bundled `init` command + shipped skills + complete agent docs make the package AI-native on install, which is the core value of a standalone, agent-first tool.

> Depends on `add-display-case` (the tool itself). That change must be archived before this one.

## What Changes

- Add a **`display-case init`** CLI command that idempotently scaffolds AI-agent integration into a target repo. For Claude Code it: merges a `display-case` entry into the repo's `.claude/launch.json`, copies the bundled skills into `.claude/skills/`, and adds a pointer to the agent guide in the repo's agent instructions file. It is **merge-aware and re-runnable** (never clobbers existing config; a second run is a no-op or a clean update) and reports exactly what it wrote or skipped.
- Make `init` **pluggable by agent type**, shipping a **Claude Code** target first; the design leaves a seam for other agents (e.g. Cursor) without committing to them now.
- Add a matching **`display-case uninstall`** command that cleanly reverses `init`: it removes the `display-case` launch entry, the bundled skills it installed, and the agent-guide pointer block — and **only** those, leaving operator-authored config and skills untouched. It is idempotent (a second run, or a run on a never-installed repo, is a no-op) and reports what it removed or skipped.
- Ship a set of **bundled, reusable skills** with the package: snapshot a component (manifest → render URL → light/dark capture), author a missing `*.case.tsx` for an uncovered component, and review/triage a11y + visual-regression findings.
- Close the **agent-facing documentation gaps**: add the missing tool-level `.prompt.md` (the terse always-loaded agent reference) and extend the AI-agent guide with how to start the server headlessly and how to rasterize the chrome-free `/render` document.

## Capabilities

### New Capabilities
<!-- None — this extends the existing display-case tool. -->

### Modified Capabilities
- `display-case`: add behavior for scaffolding AI-agent integration into a target repository and reversing it (idempotent, merge-aware, agent-pluggable, owns-only removal) and for shipping reusable agent skills. (Delivered as ADDED requirements; depends on `add-display-case` being archived first so the base spec exists.)

## Impact

- **`packages/display-case/`**: new `init` command wired into the existing `cli.ts`; a `skills/` directory holding the bundled skill sources; a tool-level `.prompt.md`; expanded `docs/ai-agents.md`.
- **Consuming repos (incl. this one)**: running `display-case init` writes/merges `.claude/launch.json`, adds files under `.claude/skills/`, and appends an agent-guide pointer to the agent instructions file; `display-case uninstall` reverses exactly those. All writes and removals are idempotent.
- **No production runtime impact**: `init` is a dev-time scaffolder; nothing ships in any app build.
- **Dependencies**: none new — file I/O + JSON merge only.
