## Context

Display Case is launched as a CLI (`src/cli.ts`), often via `bunx`, against a package that holds a `display-case.config.ts`. Under `bunx` the tool's install location and the developer's working directory diverge; under git worktrees several checkouts of the same package coexist on disk. The previous resolution leaned on the tool's own location for some state, which couples runs across checkouts.

## Goals

- One resolution rule, easy to predict from the command line.
- Per-checkout isolation: caches and artifacts belong to the located copy.
- Loud failure on a wrong explicit path instead of a silent empty showcase.

## Decisions

### Resolve from the working location, not the install location
`resolvePkgDir` (`src/cli.ts`) takes the target argument:
- An **explicit target** (`display-case packages/ui`) is used as given and must contain `display-case.config.ts`; a wrong directory fails loudly via `fail(...)`.
- The **default** (no argument, or `.`) calls `discoverConfigDir(process.cwd())`, which walks up from the current directory (bounded) looking for the config — so it works from the package root or any subdirectory.

This deliberately drops the old `import.meta.dir` / "installed" heuristic. The working location is the single anchor.

### Unify the bare form with `.`
`display-case` and `display-case .` now resolve identically. There is no separate "no-argument" branch, removing a class of "which directory did it pick?" confusion under `bunx`.

### Anchor all derived state to the resolved package
Resolution, the `.display-case/` build cache, and repo-relative paths all hang off the resolved package directory. Two checkouts therefore keep their caches inside their own trees and never share state. The single operational rule, documented in the README: run from inside the package (any depth) or pass the path explicitly — don't rely on a cwd that points at a sibling checkout.

### Per-worktree port hint
A busy port should not hard-fail a second checkout. An explicit `--port` wins; otherwise `DISPLAY_CASE_PORT` (set per-worktree by the dev orchestrator) is honoured, falling back to the server default. `startDisplayCase` treats the chosen port as preferred and bumps off a busy one, so parallel runs coexist.

## Risks / Trade-offs

- **Relying on cwd** means launching from an unrelated directory resolves the wrong (or no) showcase. Mitigated by the loud failure on an explicit wrong path and the documented single rule.
- **Dropping the install-location heuristic** changes the bare form's behaviour. Accepted: the previous behaviour was the ambiguous one this change exists to remove; `display-case .` was already the recommended form.

## Migration

Invocation stays backward compatible: `display-case .` and `display-case <pkgDir>` behave as before. Only the previously ambiguous bare form changes — it now matches `.`. No config or case changes required.
