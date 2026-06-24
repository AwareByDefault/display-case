## 1. Workflow

- [x] 1.1 Add `.github/workflows/ci.yml` triggered on `pull_request` and `workflow_dispatch`, with a `concurrency` group that cancels superseded in-flight runs.
- [x] 1.2 Add the `lint` job: checkout, `oven-sh/setup-bun` pinned to the repo's Bun version, `bun install --frozen-lockfile`, `bun run lint` (no-fix form), `bun run typecheck`.
- [x] 1.3 Add the `check` job: `bun install --frozen-lockfile`, `bun run check` (structure + tokens + ssr).
- [x] 1.4 Add the `test` job: `bun install --frozen-lockfile`, `bun test`.
- [x] 1.5 Add the `e2e` job: `bun install --frozen-lockfile`, `bunx playwright install --with-deps chromium`, `bun run e2e`; upload `playwright-report/` + `test-results/` as an artifact on failure.
- [x] 1.6 Add the `a11y` job: `fetch-depth: 0`, install + `playwright install --with-deps chromium`, `display-case check . --a11y --changed` with `DISPLAY_CASE_BASE_REF` = the PR base sha; upload the a11y report.
- [x] 1.7 Add the `visual` job in the pinned Playwright container (`mcr.microsoft.com/playwright:v1.61.0-noble`): `fetch-depth: 0`, mark the workspace a git safe.directory, install, `display-case check . --visual --changed`; upload `*.diff.png` on failure.
- [x] 1.8 Opt `visual` out of the default local run (`check.defaultPhases.visual = false`) so a bare `display-case check .` off-platform doesn't false-diff Linux baselines; gitignore stray `*.diff.png`.
- [x] 1.9 Add the `update-baselines` workflow (`workflow_dispatch`, same container) to re-record baselines and commit them back to a chosen branch — the CI counterpart to `bun run baselines:record`.
- [x] 1.10 Add the `openspec` merge-guard job and `tools/openspec-merge-guard.ts`: fail a PR whose diff adds or modifies an active (unarchived) proposal; allow deletions there, archived proposals, and spec changes. PR-only (needs the base sha); also runnable via `bun run check:openspec-merge`.

## 2. Verify

- [x] 2.1 Confirm the four browser-free commands pass on a clean checkout exactly as CI runs them: `bun run lint`, `bun run typecheck`, `bun run check`, `bun test`.
- [x] 2.2 Confirm `bun run e2e` passes (with Chromium installed) — the same suite the `e2e` job runs.
- [x] 2.3 Confirm the scoped render checks behave: `--changed` on a clean tree scopes to nothing, a component-local change to one component, a global-style change to all.
- [x] 2.4 Validate the workflow YAML parses and the job/step structure is well-formed.
- [x] 2.5 Confirm the merge-guard: a clean PR passes; an added active proposal fails with the documented message; an archive move (delete active + add under `archive/`) passes.

## 3. Documentation

- [x] 3.1 `contributing/linting-best-practices.md` — replace the "intentionally no PR-CI workflow defined today" note with the workflow as the documented backstop to the husky hooks (the four jobs and which commands each runs); add the `openspec` merge-guard to the gate list and checks table.
- [x] 3.2 `openspec/specs/README.md` and `openspec/config.yaml` — add the `continuous-integration` capability to the capability map.
- [x] 3.3 `contributing/NOTES.md` — record the CI/husky relationship (CI mirrors the hooks; CI uses `lint` not `lint:fix`; only `e2e` provisions a browser) if not obvious from the workflow file.
