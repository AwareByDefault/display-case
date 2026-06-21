## 1. Provider interface + defaults

- [x] 1.1 Add the provider types to `src/index.ts`: `CaseContext` (`componentId`/`caseId`/`theme`/`width`), `RenderDriver` (`open(url, ctx)`/`close`), `RenderedPage` (`screenshot`/`audit`/`dispose`), `A11yViolation`, `DiffFn` (`(images, ctx & { baselinePath }) => …`), and `providers?: { driver?, diff? }` on `DisplayCaseConfig`. Context is Option B — pure providers ignore it.
- [x] 1.2 Extract the current Playwright capture + axe audit into `src/providers/playwright-driver.ts` (default `RenderDriver`); reproduce today's behavior (1024×768, reduced motion, fonts-ready wait, WCAG A/AA tags).
- [x] 1.3 Extract the current pixelmatch/pngjs comparison into `src/providers/pixelmatch-diff.ts` (default `DiffFn`); same threshold + `.diff.png` output.

## 2. Wire the runner

- [x] 2.1 In `check.ts`, resolve `driver`/`diff` from config, else `await import()` the default modules; lazy-load so a custom-provider run imports neither default.
- [x] 2.2 Wrap default lazy-imports: on failure, throw an actionable message (exact install command + the `providers` config alternative). Browsing / `--print-manifest` / render must never trigger these imports.
- [x] 2.3 Keep the per-case × theme loop backend-agnostic (open via `driver.open(url, ctx)` → `audit()` for a11y phase, `screenshot()` + `diff(images, ctx & { baselinePath })` for visual phase), threading `CaseContext` through both.

## 3. Optional dependencies

- [x] 3.1 Move `playwright`, `@axe-core/playwright`, `pixelmatch`, `pngjs` from `devDependencies` to `optionalDependencies` in `packages/display-case/package.json`; confirm `bun install` still installs them in this workspace.

## 4. init visual-regression setup

- [x] 4.1 Add a `--with-visual` opt-in step to `init`: install the optional packages as dev deps and run `playwright install chromium`; reported as a plan item honoring `--dry-run`/`--json`.
- [x] 4.2 When interactive (TTY) and `--with-visual` not passed, prompt once to set it up; declining is a no-op for that step. Non-TTY without the flag skips it and prints a one-line hint.

## 5. Docs

- [x] 5.1 `docs/configuration.md`: document `providers.driver`/`providers.diff`, the interfaces, and the built-in default as reference.
- [x] 5.2 `docs/testing.md`: explain the default is lazy/optional, the missing-deps message, and how to inject custom providers; update the prerequisites note.
- [x] 5.3 `docs/ai-agents.md` + README: note `init --with-visual` and that browse/snapshot need no browser deps.

## 6. Verification

- [x] 6.1 Zero-config: `bun run display-case:check` behaves exactly as before (baselines still match).
- [x] 6.2 Custom-provider run: inject trivial `driver`+`diff` in a fixture config; confirm checks run and (simulated) absence of the four packages does not break it.
- [x] 6.3 Missing-default path: confirm the actionable error fires only when a default-backed check runs without the packages — not for browse/`--print-manifest`/render.
- [x] 6.4 `init --with-visual --dry-run` lists the setup step; `init` without it skips and hints. `uninstall` unaffected.
- [x] 6.5 `bun run lint` + types; `openspec validate add-display-case-snapshot-providers --strict`.
