# Testing Best Practices

The authoritative testing reference for the Display Case repo. Rules are numbered for easy reference in code review. See also [coding-best-practices.md](coding-best-practices.md), [linting-best-practices.md](linting-best-practices.md), and the product testing doc [../docs/testing.md](../docs/testing.md).

---

## 1. The test layers

Display Case has three independent test layers. Know which one a given check belongs to before you add to it.

**1.1 `bun test` — unit/integration.** Colocated `*.test.ts` files under `src/`, run by Bun's built-in runner. These cover the library internals: config resolution, case discovery, the token scanner, the init scaffolder, codegen entries. They are filesystem-backed where the code under test reads real files (see [`src/test-helpers.ts`](../src/test-helpers.ts)), but never touch a browser or a network port. This is the fast, default gate — run it constantly.

**1.2 `*.test-d.ts` — type tests.** Compile-time assertions about the public type surface. They are checked by `tsc --noEmit` (a lint concern, not a runtime one) — a type regression is a lint failure, not a test failure. See [linting-best-practices.md](linting-best-practices.md).

**1.3 Playwright `e2e/` — browse chrome e2e.** Specs named `*.spec.ts` under `e2e/` that boot a **real Display Case server** and drive the browse chrome (shell, nav rail, theme toggle, docs panel, Primer↔Cases switch). The server is the only stack involved — Playwright's `webServer` block launches `bun src/cli.ts . --port=…` pointed at this package, which dogfoods its own design system. There is no backend, database, or app stack. See [`e2e/README.md`](../e2e/README.md).

**1.4 `display-case check` — the showcase's own correctness gate.** A separate runner (the product feature, fully documented in [../docs/testing.md](../docs/testing.md)) that audits the *cases themselves* across five phases. It is both a thing this repo ships and a thing this repo runs against its own showcase. See §5.

**1.5 Publish / deploy coverage.** The `publish` command and its `prod-server` are covered by [`src/publish.test.ts`](../src/publish.test.ts) (part of `bun test`): the emitted artifacts, the served build booted in-process, and the static export. The real `docker build` of the generated Dockerfile is a separate, **Docker-gated** test ([`test/publish-container.test.ts`](../test/publish-container.test.ts), run via `bun run test:container`). See §11.

---

## 2. `bun test` discovery is scoped to `src/`

**2.1** [`bunfig.toml`](../bunfig.toml) sets `[test] root = "src"`. This is load-bearing, not cosmetic: the Playwright `e2e/` suite also uses the `*.spec.ts` naming convention, and Playwright's `test.describe()` **throws** when invoked under Bun's runner. Without the `root` scope, `bun test` would discover and crash on the e2e specs. Run the e2e suite with `bun run e2e` (Playwright), never with `bun test`.

**2.2** Because of 2.1, a `*.spec.ts` file is a Playwright spec and belongs under `e2e/`; a `*.test.ts` file is a Bun unit test and belongs under `src/`. Do not mix the conventions. A unit test placed outside `src/` will silently never run.

---

## 3. `bun test` conventions

**3.1 Colocation.** A unit test lives next to the module it tests: `discovery.ts` → `discovery.test.ts`. No separate `__tests__` tree.

**3.2 Naming.** Name `describe` blocks after the exported symbol under test and `test` cases after the observable behavior, phrased as an assertion ("resolves globs to sorted absolute paths", "throws when no config file is present"). See [`src/discovery.test.ts`](../src/discovery.test.ts) for the house style.

**3.3 Real-file scaffolding.** Modules that read the filesystem are tested against real temp directories, not mocks. Use `makeTempDir()` + `writeFiles()` from [`src/test-helpers.ts`](../src/test-helpers.ts) to build a throwaway package from a `{ relativePath: contents }` map, and clean it up in `afterEach` (`rm(dir, { recursive: true, force: true })`). Never share a temp dir across files.

**3.4 Error-path coverage.** The loaders return errors rather than throwing (`{ modules, errors }`); assert on both the happy path and the captured-error path (no default export, non-string component, throwing import). Edge cases — empty input, missing files, duplicate/overlapping globs — are part of the contract, not extras.

---

## 4. Determinism

**4.1** Tests must be deterministic and produce identical results on every run, on any machine, in any order. This mirrors Display Case's render determinism: a case that renders differently on each load cannot have a stable visual baseline.

**4.2** Do not rely on `Date.now()`, `Math.random()`, the wall clock, or ambient timezone in code under test or in test setup. If a value must vary, inject it. Code that bakes in `Date.now()`/`Math.random()` will also flake the visual-regression phase (§5) — fix it at the source.

**4.3** Tests must not depend on a developer's local environment. Do not let behavior hinge on an ambient env var that might be set in one shell and not another (or not in CI).

---

## 5. `display-case check` — the showcase correctness gate

`display-case check` is documented in full at [../docs/testing.md](../docs/testing.md); this section covers *when it runs* and *what is CI-friendly*. It has five phases in two groups.

**5.1 Static phases (no browser, CI-friendly):**

- `--structure` — static best-practice rules over files/config/catalog (coverage, classification, unique slugs, flow integrity, keyed interactive cases). `error` findings fail the run; `warn` findings are non-fatal unless `--strict`.
- `--tokens` — static parse flagging `var(--token)` references that resolve to no custom property the package defines (a `var(--x, fallback)` is still flagged — conformance to *this* package's vocabulary, not CSS validity).
- `--ssr` — server-render correctness of the showcase surfaces.

These three need no browser and no optional toolchain, so they are the cheap, always-on CI gate.

**5.2 Browser phases (need the optional Playwright toolchain):**

- `--a11y` — an axe-core audit of every rendered case, in both light and dark themes.
- `--visual` — a pixel diff of every rendered case against a stored baseline (`--update` re-records baselines after an intentional change).

These drive the same `/render/<component>/<case>` endpoint the browse iframe uses. They depend on `playwright`, `@axe-core/playwright`, `pixelmatch`, and `pngjs`, which are **`optionalDependencies`** imported lazily — only a default-backed `--a11y`/`--visual` triggers them. Install once with `display-case init <pkgDir> --with-visual` (or inject custom `providers`). Gate CI on them only where that toolchain is provisioned and (for `--visual`) baselines are committed via `baselineDir`.

**5.3** With no phase flag, every phase runs; naming a phase runs only the named phase(s). The command exits non-zero on any token/a11y/visual/structure-`error` finding, making it safe as a CI gate. Recording new baselines is not, by itself, a failure.

---

## 6. e2e locator discipline

**6.1** Drive the chrome **only** through `data-testid` attributes. Use `getByTestId` exclusively. Never `getByText`, `getByRole`, `text=`, `:has-text(`, CSS, or any other selector. Text and roles change with copy, layout, and i18n; test ids are an explicit contract that does not. The `getByText`/`getByRole` half of this rule is **enforced** by a Biome GritQL plugin scoped to `e2e/**` ([`tools/lint/e2e-locators.grit`](../tools/lint/e2e-locators.grit), suppress with `// biome-ignore`); the rest (`text=`, `:has-text(`, hardcoded testid literals) is convention, not linted — hold the line in review.

**6.2** Every test id comes from [`src/ui/test-ids.ts`](../src/ui/test-ids.ts) (`DcTestIds`). Specs import that module and pass its constants/builders to `getByTestId` — never a hardcoded string literal. A renamed id then becomes a compile-time error in both the chrome and the specs, not a silent runtime break.

**6.3** When a new chrome element needs a locator: add it to `DcTestIds` first (a constant, or a builder like `navCase(componentId, caseId)` for keyed rows), apply it in the chrome as `data-testid={DcTestIds.yourKey}`, then reference `DcTestIds.yourKey` in the spec. Component/case ids themselves are read from the live `/manifest.json` (see `e2e/helpers.ts`), never hardcoded, so specs survive renames and reordering of the showcased components.

**6.4** All Playwright specs live under `e2e/`. Do not write them anywhere else (see §2).

**6.5** When a Primer is configured the chrome lands on it at `/`; use `gotoLibrary(page)` to reach the Cases view before asserting on case chrome.

---

## 7. No sleeps

**7.1** Never use a fixed-timeout sleep (`setTimeout`/`waitForTimeout`/`sleep`/`delay`) to wait for async work. Fixed waits are simultaneously too slow and too flaky.

**7.2** Wait on a condition or event instead: Playwright's web-first assertions and `expect(locator).toBeVisible()` auto-retry; wait for the `app` test id to confirm the manifest has loaded; the `webServer` block already gates startup on the `/health` URL so specs never race the boot. If you find yourself reaching for a sleep, you are missing the real signal to wait on.

---

## 8. Isolation and parallelism

**8.1** The e2e suite is **read-only** — every spec just browses the showcase — so cases are independent and the config runs `fullyParallel: true`. Keep it that way: a spec must not mutate shared state that another spec observes. If you ever need write behavior, isolate it to its own fixture server, do not relax the parallelism for the whole suite.

**8.2** Ports are overridable via env for parallel and git-worktree runs. The primary server defaults to `3190` (`DISPLAY_CASE_PORT`); the a11y/plain/startup fixture consumers derive from it (`DISPLAY_CASE_A11Y_PORT`, `…_PLAIN_PORT`, `…_STARTUP_PORT`, defaulting to `PORT+1/+2/+3`). Set `DISPLAY_CASE_PORT` to run two checkouts at once without a collision. The defaults deliberately avoid the dev server's port.

**8.3** `reuseExistingServer` is `true` outside CI and `false` under CI (`!process.env.CI`). Locally a spec run reuses a server you already have up (fast iteration); in CI every run boots a clean server (no stale state). Do not assume a server is already running in a script.

**8.4** Unit tests isolate via per-test temp directories (§3.3), not shared global state. `retries: 0` in the e2e config means a flaky spec fails the run — fix the flake (usually a missing wait, §7, or determinism, §4), do not add retries.

---

## 9. Running everything

```bash
bun test                      # unit/integration suite (src/ only)
bun test src/discovery.test.ts  # a single file

bun run e2e:install           # one-time: install the Chromium browser for Playwright
bun run e2e                   # Playwright e2e — boots the server itself
bun run e2e:headed            # same, with a visible browser

display-case check .          # all five phases over this showcase
display-case check . --structure --tokens --ssr   # static phases only (no browser, CI-friendly)
display-case check . --a11y --visual              # browser phases (need the optional toolchain)
display-case check . --visual --update            # re-record visual baselines after an intentional change

bun run test:container        # Docker-gated: build + run the generated Dockerfile (skips if no Docker)
```

---

## 10. Quality gates

A change is complete only when the unit suite, the static `display-case check` phases, and lint all pass, and any chrome change is covered by the e2e suite. `tsc --noEmit` (which includes `*.test-d.ts` and test files) is part of lint, so a type error in a test counts as a lint failure. For the full check inventory and gating model see [linting-best-practices.md](linting-best-practices.md).

---

## 11. Publish / deploy testing

The publish path produces a deployable artifact, so it is tested at three levels — the first two Docker-free and always-on, the third Docker-gated.

**11.1 Artifacts (unit).** [`src/publish.test.ts`](../src/publish.test.ts) runs `publish` into a temp dir and asserts the build is what a deploy expects: content-hashed `browser`/`render` bundles, a frozen `manifest.json` + `dc-build.json` (with `a11y: false` — dev surfaces excluded), the built SSR renderers under `server/`, and the generated `server.ts` (imports `display-case/prod-server`, no `__livereload`), `package.json` (a `bun server.ts` service), and `Dockerfile` (Bun base + `/health` check). `--base` is asserted to prefix the asset URLs.

**11.2 Served + static (integration).** The same file boots the served build **in-process** via `startProdServer(out, { port: 0 })` and asserts `/health`, a server-rendered shell that links the hashed bundle and carries no dev live-reload, a chrome-free pre-scripting `/render/...` document, and `immutable` asset caching — then asserts the `--static` export writes complete `index.html` + per-case render documents. Note the build dir is anchored **inside the repo** (`.tmp/`, gitignored): the SSR bundle keeps `react`/`react-dom` external, so resolution must reach the repo's `node_modules` (a real deploy installs them alongside the build); a `/tmp` dir would fail to resolve React.

**11.3 Container (Docker-gated).** [`test/publish-container.test.ts`](../test/publish-container.test.ts) does a real `docker build` of the generated Dockerfile, runs the image, polls `/health`, and asserts the shell serves. It lives **outside** the `bun test` root (`src/`) so it never runs in the default suite or pre-commit — invoke it with `bun run test:container`. It **skips gracefully** (`describe.skip`) when Docker (or its daemon) is absent, so it never fails a Docker-less machine. Because `display-case` isn't published to npm yet, the test substitutes a locally-packed tarball (`bun pm pack`) for the generated `display-case: latest` dependency so the container build doesn't depend on npm publication; once published, that substitution becomes unnecessary.
