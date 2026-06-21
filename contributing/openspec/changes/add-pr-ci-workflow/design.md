## Context

Display Case's quality gate runs locally through husky hooks: `.husky/pre-commit`
runs the browser-free gate (`lint:fix`, `typecheck`, `check`, `bun test`) and
`.husky/pre-push` runs the Playwright e2e suite. `contributing/linting-best-practices.md`
records the residual risk — hooks are bypassable and absent for bot/GitHub-web
edits and merge-button merges — and names "the same commands run in a CI step"
as the aligned backstop. No CI exists yet. This change adds it.

The repo is Bun-native (`bun` is the package manager and runner) with a committed
`bun.lock`. Local Bun is `1.3.14`. The e2e suite (`playwright.config.ts`) launches
its own Display Case servers via `webServer` and only needs a Chromium browser; it
keys off `process.env.CI` to disable `reuseExistingServer` so each CI run boots
clean.

## Goals / Non-Goals

**Goals:**
- Run the existing gate on every open pull request, so nothing merges via a PR
  without passing lint+typecheck, static checks, unit tests, and e2e.
- Mirror the local commands exactly, so green-locally implies green-in-CI.
- Make each layer an independent signal — a failure names the offending layer.

**Non-Goals:**
- No new branch-protection rules (configured in GitHub settings, out of band).
- No change to Display Case runtime behavior, dependencies, or the published build.
- No *unscoped* render checks: a11y/visual run change-scoped (see the
  `change-scoped-checks` capability), not over the whole showcase every PR.
- No release/publish automation; this is a PR backstop only.

## Decisions

- **One workflow, independent parallel jobs (`lint`, `check`, `test`, `e2e`,
  `a11y`, `visual`).** Each job is independent and surfaces as its own PR check,
  so a red check points straight at the failing layer. Alternative — a single
  sequential job — was rejected: it hides which layer failed and serializes the
  fast browser-free work behind the slow browser runs. The cost is re-running
  `checkout` + `setup-bun` + `bun install` per job; Bun installs are fast and
  `setup-bun` caches Bun itself, so the parallelism wins.
- **The render checks (`a11y`, `visual`) run change-scoped via `--changed`.**
  Re-auditing all ~100 cases on every PR is wasted work; `--changed` (the
  `change-scoped-checks` capability) restricts them to the affected components.
  `actions/checkout` uses `fetch-depth: 0` and the job passes the PR base sha via
  `DISPLAY_CASE_BASE_REF` so `git diff` has a resolvable merge-base; on
  `workflow_dispatch` (no PR) the ref falls back to `origin/main`.
- **`visual` runs inside the pinned Playwright container.** Pixel baselines are
  recorded in `mcr.microsoft.com/playwright:v1.61.0-noble`
  (scripts/record-baselines.ts); the visual job renders in that *same* image so a
  diff reflects a real change, not a macOS↔Linux font-rendering difference. The
  image tag, the baseline-recording image, and the `playwright` version in
  bun.lock must move together. `a11y` needs no baselines (axe is DOM-rule-based),
  so it runs on the plain runner with `playwright install --with-deps chromium`,
  like `e2e`.
- **`visual` is opt-out of the default local run.** Committed baselines are
  Linux-recorded, so a bare `display-case check .` on a contributor's macOS would
  report false diffs. The config sets `check.defaultPhases.visual = false`, so
  the default run skips it locally; CI passes `--visual` explicitly (and runs in
  the matching container), so the gate is unaffected. The husky hooks never ran
  visual, so the local gate is unchanged either way.
- **`bun run lint`, not `lint:fix`.** CI must *verify*, failing on unformatted or
  unlinted code, rather than silently auto-fixing it (which would make CI pass on
  a tree that the author never cleaned). The pre-commit hook uses `lint:fix` for
  author convenience; CI uses the no-fix form. This matches the intent already
  noted in `.husky/pre-commit`.
- **`bun install --frozen-lockfile`.** CI installs exactly the committed
  `bun.lock` and fails if it is stale, rather than silently resolving a different
  tree. `bun install` installs `optionalDependencies` (Playwright, axe, pixelmatch,
  pngjs) by default, so the e2e job gets the toolchain it needs.
- **Pin `oven-sh/setup-bun` to `bun-version: 1.3.14`.** Match local so CI and dev
  resolve identically; deliberate over `latest`, which would drift unannounced.
- **e2e provisions the browser with `bunx playwright install --with-deps chromium`.**
  The repo script `e2e:install` runs `playwright install chromium`; on a clean
  Ubuntu runner the browser also needs OS libraries, so `--with-deps` is added.
  Only the `e2e` job pays this cost; the three browser-free jobs skip it.
- **Trigger on `pull_request` + `workflow_dispatch`.** PRs are the gate;
  `workflow_dispatch` allows a manual re-run. No `push` trigger — the default
  branch is reached only through PRs, so a separate push run would be redundant.
- **`concurrency` with `cancel-in-progress`.** A new push to a PR cancels the
  superseded run, saving runner minutes.
- **No CI in OpenSpec specs.** Specs describe Display Case's observable behavior
  and may not name tools or survive only one stack; a GitHub Actions workflow is
  repository infrastructure. So this change carries no spec delta — the contract
  lives in the workflow file and the linting guide.

## Risks / Trade-offs

- **e2e flakiness in CI** (browser timing, server boot) → `playwright.config.ts`
  already sets a 60s `webServer` timeout and disables server reuse under CI; the
  workflow uploads `playwright-report/` + `test-results/` as an artifact on
  failure so a flake is diagnosable. `retries` stays at the repo default (0) to
  keep failures honest; revisit only if real flake appears.
- **Per-job `bun install` overhead** → accepted for clearer signal; mitigated by
  `setup-bun` caching and fast Bun installs.
- **Pinned Bun version drifts from a future local bump** → the version lives in
  one place in the workflow; bumping local Bun should update it (a one-line edit),
  the same discipline already applied to other pinned tool versions.
