---
name: test-in-worktree
description: Run the unit/integration test suite (`bun test`) from inside a git worktree, including the node_modules setup a fresh worktree needs first. Use when working in a `.claude/worktrees/*` checkout and asked to "run the tests", "run the test suite", "bun test", or to verify a change before committing from a worktree. (For the Playwright e2e suite use `run-e2e`.)
---

# test-in-worktree

Run `bun test` (the colocated `*.test.ts` / `*.test-d.ts` suites under `src/`)
from a git worktree. A fresh worktree has **no `node_modules`** — it is
gitignored, so `git worktree add` copies none — and the suites can't run without
it. So **set up `node_modules` first**, then test.

Display Case has **no database and no service stack** — the unit suite is pure
in-process Bun tests. There is nothing to provision (no Docker, no Mongo). The
only external setup is `node_modules`.

## Step 1 — set up node_modules in the worktree

From the worktree root:

```bash
bun install
```

~2s from bun's global cache. It leaves `git status` clean. Single-package repo,
so `bun install` is always correct (no workspace relinking, no symlink shortcut).

## Step 2 — run the suite

From the worktree root:

```bash
bun test                 # all unit + type tests under src/
bun test <path>          # a single file while iterating
```

`bun test` is scoped to `src/` (see `bunfig.toml` `[test] root = "src"`) so it
does **not** pick up the Playwright `*.spec.ts` files under `e2e/` (Playwright's
`test.describe()` throws under Bun's runner). Run those with `run-e2e`.

## Interpreting results

- All suites pass → report the pass count and confirm.
- A suite fails → show the failing file + test name and the error; diagnose and
  fix the root cause.
- Errors about missing modules → node_modules setup is incomplete; re-run
  `bun install`.

For the Playwright **e2e** suite (the browse chrome), use the `run-e2e` skill.

## Prerequisites

- cwd is the worktree root (under `.claude/worktrees/<name>/`).
- node_modules set up per Step 1.
