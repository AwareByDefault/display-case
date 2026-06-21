## 1. Workflow

- [ ] 1.1 Add `.github/workflows/ci.yml` triggered on `pull_request` and `workflow_dispatch`, with a `concurrency` group that cancels superseded in-flight runs.
- [ ] 1.2 Add the `lint` job: checkout, `oven-sh/setup-bun` pinned to the repo's Bun version, `bun install --frozen-lockfile`, `bun run lint` (no-fix form), `bun run typecheck`.
- [ ] 1.3 Add the `check` job: `bun install --frozen-lockfile`, `bun run check` (structure + tokens + ssr).
- [ ] 1.4 Add the `test` job: `bun install --frozen-lockfile`, `bun test`.
- [ ] 1.5 Add the `e2e` job: `bun install --frozen-lockfile`, `bunx playwright install --with-deps chromium`, `bun run e2e`; upload `playwright-report/` + `test-results/` as an artifact on failure.

## 2. Verify

- [ ] 2.1 Confirm the four CI commands pass on a clean checkout exactly as CI runs them: `bun run lint`, `bun run typecheck`, `bun run check`, `bun test`.
- [ ] 2.2 Confirm `bun run e2e` passes (with Chromium installed) — the same suite the `e2e` job runs.
- [ ] 2.3 Validate the workflow YAML parses and the job/step structure is well-formed.

## 3. Documentation

- [ ] 3.1 `contributing/linting-best-practices.md` — replace the "intentionally no PR-CI workflow defined today" note with the workflow as the documented backstop to the husky hooks (the four jobs and which commands each runs).
- [ ] 3.2 `contributing/openspec/specs/README.md` and `contributing/openspec/config.yaml` — add the `continuous-integration` capability to the capability map.
- [ ] 3.3 `contributing/NOTES.md` — record the CI/husky relationship (CI mirrors the hooks; CI uses `lint` not `lint:fix`; only `e2e` provisions a browser) if not obvious from the workflow file.
