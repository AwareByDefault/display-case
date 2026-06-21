# Testing

> Nav: [Quick start](quick-start.md) · [Writing cases](writing-cases.md) · [Hierarchy](hierarchy.md) · [Tweaks](tweaks.md) · [Theming](theming.md) · [Documentation panel](documentation-panel.md) · [Writing placard docs](writing-placard-docs.md) · **Testing** · [CLI](cli.md) · [AI agents](ai-agents.md) · [Configuration](configuration.md)

`display-case check` runs three kinds of audit over your cases:

- **Token conformance** — a static parse that flags `var(--token)` references which resolve to no custom property the package defines. No browser.
- **Accessibility** — an axe-core audit of every rendered case.
- **Visual regression** — a pixel diff of every rendered case against a stored baseline.

The a11y and visual phases drive the same `/render/<component>/<case>` endpoint the browse iframe uses, so what is tested is exactly what a viewer sees. Each case is exercised in **both** light and dark themes.

```bash
display-case check .            # run all phases
display-case check . --tokens   # token conformance only (static, no browser)
display-case check . --a11y     # a11y only
display-case check . --visual   # visual only
display-case check . --update   # (re)record visual baselines
```

With no phase flag, every phase runs; naming any phase flag runs only the named phase(s).

Wrapped as an npm script (see [CLI](cli.md)):

```bash
bun run display-case:check
```

> The default runner uses Playwright's Chromium. Those packages are **optional** (see below); when present, pages are rendered at a fixed 1024×768 viewport with reduced motion, and the runner waits for the network to settle and fonts to load before auditing.

## The default backend is lazy and optional

The capture/audit driver and the image diff are pluggable (config [`providers`](configuration.md#providers)). When you leave them unset, Display Case uses a built-in default: a Playwright + axe driver and a pixelmatch/pngjs diff. That default backs `playwright`, `@axe-core/playwright`, `pixelmatch`, and `pngjs` as **`optionalDependencies`** — and it is imported **lazily**, only when a default-backed `check --a11y`/`--visual` actually runs.

So the four packages are needed *only* for a default-backed check. Browsing, snapshotting (`/render`, `--print-manifest`), the token phase (`check --tokens`), and `init` never touch a browser and never trigger the import.

If a default-backed check runs without those packages installed, it fails with an actionable error — install the toolchain, run `init --with-visual`, or inject your own providers:

```
Visual/a11y checks need the default toolchain. Install it with
`bun add -d playwright @axe-core/playwright pixelmatch pngjs && bunx playwright install chromium`
(or run `display-case init --with-visual`), or set `providers.driver`/`providers.diff` in display-case.config.ts.
```

The on-demand setup step is the easiest path:

```bash
display-case init <pkgDir> --with-visual   # bun add the deps + install Chromium
```

See [AI agents → Scaffolding integration](ai-agents.md#scaffolding-integration-init--uninstall).

### Injecting a custom provider

Setting a [provider](configuration.md#providers) replaces the corresponding default and removes the need for the four packages. Point `diff` at a hosted service or a looser comparator, or point `driver` at a different headless browser:

```ts
// display-case.config.ts
export default defineConfig({
  title: 'Display Case',
  roots: ['src/components/**/*.case.tsx'],
  providers: {
    driver: () => myDriver(),  // unset half still falls back to the built-in
    diff: myDiff,
  },
})
```

Each provider receives the `CaseContext` (`componentId`, `caseId`, `theme`, `width`), so identity-aware providers can vary per case while pure ones ignore it. The built-ins double as reference implementations: [`src/checks/providers/playwright-driver.ts`](../src/checks/providers/playwright-driver.ts) and [`src/checks/providers/pixelmatch-diff.ts`](../src/checks/providers/pixelmatch-diff.ts). See [Configuration → `providers`](configuration.md#providers) for the full interfaces and a worked per-case-tolerance diff.

## Structure checks

The structure phase (`check --structure`) is a set of static best-practice rules — no browser, no server. Each finding carries a **severity**: `error` findings fail the run, `warn` findings are reported but non-fatal (unless `--strict` escalates them). Rules are grouped by what they read:

**File / config rules** (default on, error):

- `case-placard-coverage` — every showcasable component has a sibling `*.case.tsx` **and** `*.placard.md`.
- `no-orphaned-placard-doc` — every `*.placard.md` has a sibling `*.case.tsx` (a component module is not required).
- `primer-present-and-used` — a primer is configured, exists, embeds ≥1 `<Display>` specimen, and has prose (parsed, not regex-scanned).
- `setup-present` — custom `providers` are configured, or the default snapshot toolchain resolves from either the showcase or the Display Case package itself (so a toolchain provided transitively via Display Case is not a false miss).
- `config-paths-exist` — `globalStyles` entries (and `baselineDir`) resolve.

**Catalog-integrity rules** (default on, error):

- `levels-classified` — every component declares a hierarchy level (none left unclassified).
- `cases-load` — every case file loads.
- `flow-transitions-resolve` — every flow step transition targets an existing step.
- `flow-multi-step` — a flow has more than one step.
- `unique-slugs` — no two components, or two cases within a component, collide on their address slug.
- `tweak-defaults-valid` — a `choice` tweak's default is one of its options.

**Case-content rules** (default on, error):

- `interactive-cases-keyed` — a locally-defined stateful specimen (a wrapper that calls `useState`/`useReducer`) reused across **≥2** cases carries a `key` on every usage. The browse chrome swaps cases in place without unmounting, so an unkeyed wrapper keeps the previous case's state on switch (see [Writing cases → Authoring rules](writing-cases.md#authoring-rules)). Single-use specimens are exempt (they always remount). Heuristic, regex-based: it checks for *presence* of a `key`, not that the keys are distinct.

**Composition (import-graph) rules** (opt-in, default **off**):

- `atom-purity` (error) — an `atom` imports no other showcased component.
- `no-downward-dependency` (error) — no component imports a strictly-higher-level component (same-level is allowed; an organism may compose other organisms).
- `composes-lower-level` (warn) — a non-atom imports at least one lower-level showcased component. An organism built only of atoms passes.
- `level-fit` (warn) — a component composing more lower-level parts than its level's threshold is flagged for promotion.

Composition rules scan imports and resolve them to levels, following workspace re-exports so a component that imports its atoms from another showcase in the same workspace is understood. An import that can't be resolved to a showcased component is never an error; a workspace-showcase import the resolver can't follow is reported as a warning.

```
structure ✗ src/components/button.tsx: missing colocated usage doc (expected a sibling *.placard.md) (case-placard-coverage)
structure ⚠ src/sections/header.tsx: organism "Header" composes no lower-level showcased component (composes-lower-level)
```

Escapes:

- **Per file** — a `display-case: <token>` comment. `no-case` marks a module non-showcasable (exempt from coverage entirely); `no-placard` waives only the prompt; `allow-orphan` (in a `*.placard.md`) waives the orphan rule; `unclassified` (in a `*.case.tsx`) waives the level rule; any other rule accepts `allow-<rule-id>` in the relevant source file. Include a reason after the token.
- **Per path** — `check.structure.rules.<id>.ignore` globs (see [Configuration](configuration.md)); the only escape for findings not tied to one editable file (e.g. `unique-slugs`).
- **Per rule** — set the rule to `false` to disable it, or `'warn'`/`'error'` to retune its severity.

## Token conformance

A package's design tokens are a closed vocabulary: the custom properties its `globalStyles` define, plus any set at runtime via an inline `style={{ '--x': … }}` object. This phase scans the package source (component CSS/TSX **and** case files) and flags every `var(--token)` whose name is in neither set — the class of bug where a component borrows a foreign design system's token (`var(--muted-foreground, #6b7280)`) that never resolves and silently falls back to a hardcoded value.

```
tokens ✗ src/components/tweak-control.case.tsx:18:30 unknown token --muted-foreground (fallback does not excuse it)
```

It is deliberately strict: a `var(--x, fallback)` is still flagged even though the fallback makes it valid CSS — the rule is conformance to *this* package's vocabulary, not CSS validity. Comments and string contents are handled so a `var()` inside a comment is ignored while one inside a JS string (real usage) is checked.

Escapes:

- **Per reference** — an `allow: unknown-token` comment on the offending line or the line directly above it.
- **Per token** — list names the package legitimately references but does not define (e.g. tokens a host app supplies) under `tokens.allow` in the config:

  ```ts
  export default defineConfig({
    title: 'Display Case',
    roots: ['src/components/**/*.case.tsx'],
    globalStyles: ['./src/tokens.css', './src/components.css'],
    tokens: { allow: ['--app-provided-token'] },
  })
  ```

## Accessibility

For every case in every theme, the runner analyzes the page with axe-core and reports each violation, followed by the affected nodes — for colour-contrast, the failing element and the exact measured-vs-required pair, so a finding is fixable without re-running a browser:

```
a11y ✗ tweak-control/variants [dark] color-contrast: Elements must meet contrast ratio (2 node(s))
      ↳ .dcui-tweak-label  #8a8073 on #ffffff = 3.87:1 (need 4.5:1)  [12.0pt (16px) normal]
      ↳ .dcui-tweak-url  #8a8073 on #ffffff = 3.87:1 (need 4.5:1)  [12.0pt (16px) normal]
```

The inline list is capped per violation (with a `+N more` note); the **complete** results of every run — each failing case with its per-node detail — are written to `.display-case/a11y/last-check.json` (under the gitignored cache, overwritten each run, empty on a clean run). Read that file to inspect the exact failing colours/elements later without re-running the checks. The per-node detail is present whenever the audit mechanism provides it (the built-in axe driver always does); a custom [`providers.driver`](configuration.md#providers) MAY populate or omit it.

The detail rides on the same machine-readable violation shape the in-app surface uses, but the running Accessibility panel deliberately shows only the per-variant verdict (rule, severity, node count) — the per-node detail stays in the gate output and the persisted report.

The isolated render document is a complete page (a `<title>`, `lang`, and a single `<main>` landmark) so the audit reports real component issues rather than harness chrome.

## Visual regression

For every case in every theme, the runner takes a screenshot and compares it to a baseline PNG:

- **No baseline yet** → the screenshot is recorded as the new baseline (counted as "recorded", not a failure).
- **Baseline matches** → pass.
- **Baseline differs** → failure. A `<case>.<theme>.diff.png` is written next to the baseline so you can inspect the change.
- **Dimensions changed** → failure. The new render is saved as `<case>.<theme>.actual.png` for inspection.

```
visual ✗ tweak-control/variants [light] differs from baseline
```

The diff threshold is strict: any differing pixel counts as a change.

### Recording and updating baselines

Pass `--update` to (re)record every baseline from the current renders. Do this after an intentional visual change, then review the new PNGs before committing.

```bash
display-case check . --visual --update
```

When baselines are committed and diffed in CI (Linux), record them in that same environment so they match — this repo provides two paths:

- **Locally** — `bun run baselines:record` records inside the pinned Playwright Docker image (`scripts/record-baselines.ts`). Requires Docker. Review the diff and commit the PNGs.
- **From CI** — run the **Update visual baselines** workflow (`.github/workflows/update-baselines.yml`) via *Actions → Run workflow*. Pick the branch, optionally an `only` filter, and it records in the CI container and commits the refreshed baselines back to that branch (`[skip ci]`). Use this when you don't have Docker locally.

### Where baselines live

By default baselines are written to the gitignored cache at `.display-case/baselines/`, organized as `<component>/<case>.<theme>.png`. These are local-only and will be recorded fresh on a clean checkout.

To **commit** baselines and gate CI on them, point `baselineDir` at a tracked directory in your config:

```ts
// display-case.config.ts
export default defineConfig({
  title: 'Display Case',
  roots: ['src/components/**/*.case.tsx'],
  baselineDir: 'baselines', // committed; resolved relative to the package
})
```

`baselineDir` accepts a path relative to the package or an absolute path. See [Configuration](configuration.md#baselinedir).

> **Committed baselines must match the environment that diffs them.** Pixel
> renders differ across operating systems (fonts, antialiasing). If CI diffs in
> Linux, record the committed baselines in that same Linux environment, not on a
> developer's machine — otherwise every CI run reports false changes. This repo
> records them in the pinned Playwright Docker image via `bun run
> baselines:record`; see [contributing/testing-best-practices.md](../contributing/testing-best-practices.md).
>
> Because of this, a repo with committed (Linux) baselines should opt `visual`
> out of the **default** run so a bare `display-case check .` on a contributor's
> machine doesn't report off-platform false diffs. Set
> [`check.defaultPhases`](configuration.md)`: { visual: false }`; the phase still
> runs when asked explicitly (`--visual`) and in CI. This repo does exactly that.

## Change-scoped checks

The a11y and visual phases re-render every case, which is wasteful in CI when a
change touched only a few components. Two flags restrict them to a subset (the
static phases are unaffected):

- `--only=<ids/globs>` — check only the named components (comma-separated).
- `--changed[=ref]` — check only the components a change touched since `ref`
  (default the base branch; override with `=ref` or `DISPLAY_CASE_BASE_REF`).

With `--changed`, a component is in scope when a changed file is in its **import
closure** — the case, the component, and everything they reference transitively
(including stylesheets reached by `@import`). Two deliberate fallbacks keep it
sound:

- A render-relevant change that **no** component's closure claims — a
  globally-applied stylesheet, the shared render path, other shared source —
  scopes to **every** component, so a regression is never silently skipped.
- A change touching **no** render input (docs, specs, tests, tooling) scopes to
  **nothing**: the render phases report success without launching a browser.

When both flags are given, the scope is their intersection. This is what the CI
a11y/visual jobs use to gate a PR on only the components it could have affected.

```bash
display-case check . --a11y --only=button
display-case check . --a11y --visual --changed=origin/main
```

## Exit codes

`display-case check` exits **0** when there are zero token violations, zero a11y violations, zero visual changes, and zero **error**-severity structure findings, and **1** otherwise. Structure **warnings** are reported but do not, by themselves, cause a non-zero exit unless `--strict` (or `check.structure.strict`) escalates them. Recording new baselines does not, by itself, cause a non-zero exit. This makes the command safe to use as a CI gate.
