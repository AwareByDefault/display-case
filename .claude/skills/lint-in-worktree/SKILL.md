---
name: lint-in-worktree
description: Run the lint/type/static-check suite from inside a git worktree, including the node_modules setup a fresh worktree needs first. Use when working in a `.claude/worktrees/*` checkout and asked to "lint", "run the linter", "run lint", or to verify a change passes the pre-commit checks before committing from a worktree.
---

# lint-in-worktree

Run the quality gate (Biome + `tsc` + the static Display Case checks) from a git
worktree. A fresh worktree has **no `node_modules`** — it is gitignored, so
`git worktree add` copies none. `tsc` and Biome resolve modules and silently fail
or error without it. So **set up `node_modules` first**, then lint.

## Step 1 — set up node_modules in the worktree

From the worktree root:

```bash
bun install
```

~2s from bun's global cache. It leaves `git status` clean (real dirs, properly
ignored). This is a single-package repo — there are no workspace packages to
relink, so `bun install` is always the right call (no symlink shortcut needed).

## Step 2 — run the gate

From the worktree root:

```bash
bun run lint         # biome check (formatting + lint rules)
bun run typecheck    # tsc --noEmit
bun run check        # display-case check --structure --tokens --ssr (browser-free)
```

`bun run lint:fix` applies Biome's safe fixes (matches what pre-commit does).
The three static `display-case` phases (`--structure --tokens --ssr`) need no
browser and run in milliseconds — they are the showcase's own lint-equivalent
gate. Full rule list and per-rule escape hatches: [docs/testing.md](../../../docs/testing.md)
and [contributing/linting-best-practices.md](../../../contributing/linting-best-practices.md).

## Interpreting results

- All checks pass → report that lint is clean.
- A check fails → show the failing check + message, fix the **root cause** (do
  not suppress; lint errors are not to be skipped).
- `tsc`/`biome` errors about missing modules (`Cannot find module 'react'`,
  `react/jsx-runtime`) → node_modules setup is incomplete. Re-run `bun install`
  and lint again.

## Why this is worktree-safe

Display Case holds no global or main-repo state: resolution, the `.display-case/`
build cache, and repo-relative paths all anchor to the package you point it at
(`.` resolves the nearest `display-case.config.ts` walking up from cwd). Run the
checks from inside the worktree (cwd within the checkout) and everything — cache,
output, baselines — stays inside that worktree; two checkouts never clobber each
other.

## Prerequisites

- cwd is the worktree root (under `.claude/worktrees/<name>/`).
- node_modules set up per Step 1.
