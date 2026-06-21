# Worktree-safe execution

Agents and developers increasingly run several checkouts of a repo side by side —
git **worktrees** for parallel branches, agent isolation, or review copies.
Display Case is built so that N working copies run independently with **no shared
or clobbered state**. This doc explains the guarantee, the one rule you must
follow, and the `node_modules` setup a fresh worktree needs.

## The guarantee

Display Case holds **no global or main-repo state**. Resolution, the
`.display-case/` build cache (codegen + bundle cache + local visual-regression
baselines + a11y cache), and all repo-relative paths anchor to **the package you
point it at** — never to where the tool itself is installed. So:

- A worktree's run stays entirely inside that worktree.
- Two checkouts never read or write each other's build cache or baselines.
- An agent's component edits show up in the showcase that worktree serves.

This is enforced behavior, specified under
[openspec/specs/showcase-location/spec.md](openspec/specs/showcase-location/spec.md)
(the original change: `openspec/changes/archive/2026-06-19-make-display-case-worktree-safe`).

## How the target is resolved

There are exactly two ways to name the target, both anchored where you'd expect:

- **`.` (or no argument)** — discovers the nearest `display-case.config.ts` by
  walking **up from the current directory** (bounded). Run from anywhere inside
  the worktree (any depth) and you get that worktree's package. The bare
  `display-case` and `display-case .` resolve **identically** — there is no
  separate "no-argument" behavior to reason about (important under `bunx`, where
  the tool's install location and your working directory differ).
- **explicit `<pkgDir>`** (`display-case apps/foo`) — used as given, and
  validated to contain a `display-case.config.ts`. A wrong directory **fails
  loudly** rather than silently serving an empty or unrelated showcase. Relative
  paths resolve against the current directory, so a worktree-relative path stays
  in the worktree.

**The one rule:** launch it from inside the worktree (cwd within the checkout),
or pass a worktree path explicitly — don't rely on a process cwd that points at a
sibling checkout. Agent launch configs (`.claude/launch.json`) pass an explicit
package path for exactly this reason.

## Ports

A busy port should not hard-fail a second checkout. An explicit `--port` wins;
otherwise `DISPLAY_CASE_PORT` (set per-worktree) is honored, falling back to the
server default (3100). The server treats the chosen port as *preferred* and bumps
off a busy one, so parallel runs coexist. The Playwright e2e config takes the
same env overrides (`DISPLAY_CASE_PORT`, `DISPLAY_CASE_A11Y_PORT`, …).

## Running checks/tests from a fresh worktree

A fresh worktree has **no `node_modules`** — it is gitignored, so `git worktree
add` copies none, and `tsc`/Biome/the test suites can't resolve modules without
it. This is a single-package repo, so setup is just:

```bash
bun install          # ~2s from bun's global cache; leaves git status clean
```

Then run the gate from the worktree root:

```bash
bun run lint         # biome
bun run typecheck    # tsc --noEmit
bun run check        # display-case check --structure --tokens --ssr (browser-free)
bun test             # unit / type tests
bun run e2e          # Playwright chrome suite (one-time: bun run e2e:install)
```

The bundled skills automate this: **`lint-in-worktree`**, **`test-in-worktree`**,
and **`run-e2e`** (under `.agents/skills/` and `.claude/skills/`) each set up
`node_modules` first, then run their suite.

## See also

- [coding-best-practices.md](coding-best-practices.md) — render purity and the
  determinism rules that make isolated runs reproducible.
- [testing-best-practices.md](testing-best-practices.md) — parallel-safe,
  read-only e2e isolation and env-overridable ports.
- Product doc: [../docs/cli.md](../docs/cli.md) — every command and flag.
