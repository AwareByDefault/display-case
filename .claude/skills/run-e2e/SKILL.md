---
name: run-e2e
description: Run the Playwright e2e suite for the Display Case browse chrome via `bun run e2e`. The suite launches its own Display Case server (no app stack, no database) and drives the shell, navigation, docs panel, and Primer. Use when the user wants to run, verify, or check e2e tests.
---

# run-e2e

Run the full Playwright e2e suite via the project's script.

## How to launch

```bash
bun run e2e            # headless
bun run e2e:headed     # headed (watch it drive the browser)
```

Run from the repo root (or a worktree root). The suite is **self-contained**:
`playwright.config.ts` declares `webServer` entries that boot real Display Case
servers — this package's own showcase plus a few dummy consumer fixtures under
`e2e/fixtures/` (one with live a11y on + a known violation, one control, one with
`a11y.startup: 'refresh'`). No Mongo, no API, no app — Display Case is a
self-contained dev tool, so the e2e suite owns everything it needs.

## One-time setup

```bash
bun install            # if node_modules is absent (fresh worktree)
bun run e2e:install    # install the Chromium browser Playwright drives
```

If you hit `Cannot find package 'playwright'` or a missing/mismatched browser
executable, see the `playwright` skill.

## Locators

The specs locate elements **only** via the `data-testid`s exported from
`src/ui/test-ids.ts` — never `getByText`/`getByRole`/`text=`. See
[contributing/testing-best-practices.md](../../../contributing/testing-best-practices.md).

## Parallel / worktree runs

The suite is read-only and `fullyParallel`. Ports are overridable via env
(`DISPLAY_CASE_PORT`, `DISPLAY_CASE_A11Y_PORT`, …) and outside CI the config
reuses an already-running server, so concurrent worktree runs don't collide.

## Interpreting results

- All specs pass → report the pass count and confirm.
- A spec fails → use the `fix-e2e-errors` skill: read the error context under
  `test-results/`, diagnose, and fix the root cause (test or chrome code).
