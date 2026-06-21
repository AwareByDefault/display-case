## Why

The quality gate (lint, typecheck, static checks, unit tests, e2e) runs only
through husky git hooks today. Hooks are bypassable (`--no-verify`), absent in a
clone where `bun install` never ran, and skipped entirely for bot/GitHub-web
edits and off-machine merges (the GitHub merge button) — any of which can land
unchecked code on the default branch. The linting guide already names this
residual risk and points at "the same commands run in a CI step" as the aligned
backstop. This change adds that backstop so nothing merges via a pull request
without passing the gate.

## What Changes

- Add a **GitHub Actions workflow** that runs on every open pull request (and on
  manual dispatch), mirroring the existing local gate:
  - **lint** — `bun run lint` (the no-fix verification form) + `bun run typecheck`
  - **check** — `bun run check` (the static `--structure --tokens --ssr` phases)
  - **test** — `bun test` (unit/type tests)
  - **e2e** — `bun run e2e` (the Playwright browse-chrome suite, with its Chromium browser provisioned)
- The four run as **independent parallel jobs**, so each surfaces as its own PR
  check and a failure points straight at the offending layer.
- In-flight runs for a ref are **cancelled when a new commit is pushed**.
- This is **repo engineering tooling only**. It changes no Display Case runtime
  behavior, adds no runtime dependency, and ships nothing into a consuming build
  or a published showcase.

## Capabilities

### New Capabilities
- `continuous-integration`: the repository automatically runs its full quality
  gate (static analysis + type checking, the project's own static checks, unit
  tests, and end-to-end tests) against every proposed change before it can be
  integrated, and reports each layer independently. Stated at a tool-agnostic
  altitude — it names no CI provider, runner, or package manager, so the spec
  survives a stack migration. The concrete GitHub Actions wiring is the
  implementation, captured in `design.md` and the workflow file.

### Modified Capabilities
<!-- none -->

## Impact

- **New file**: `.github/workflows/ci.yml` — the PR workflow (lint, check, test,
  e2e jobs).
- **Docs**: `contributing/linting-best-practices.md` — replaces the "intentionally
  no PR-CI workflow defined today" note with the workflow as the documented
  backstop to the husky hooks.
- **No source/runtime impact**: no changes under `src/`, no new dependency, no
  effect on the published showcase or any consuming application.
