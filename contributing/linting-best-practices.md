# Linting Best Practices

The authoritative reference for this repo's linting: how it's gated, how to run it,
what every check enforces, and how to add a new one. Other docs link here rather
than restating it.

This is a single-package repo (`display-case`). The quality gate is **Biome**
(format + lint), **`tsc --noEmit`** (types), this project's **own static checks**
via `display-case check --structure --tokens --ssr`, and a small set of
**project-specific custom checks** under [`tools/lint/`](../tools/lint/) for rules
Biome and `tsc` can't express (run together via `bun run lint:checks`). The
sprawling multi-package lint runner of the monorepo this came from is gone; what
remains is a lean set scoped to one package.

---

## 1. How linting is gated

Quality gates run through **git hooks (husky)**, not a separate CI lint job.

- **`.husky/pre-commit`** — on commits that touch code (not docs/specs only), runs
  the static, browser-free gate:
  ```bash
  bun run lint:fix     # biome (format+lint, auto-fix) + custom checks (tools/lint)
  bun run typecheck    # tsc --noEmit
  bun run check        # display-case --structure --tokens --ssr (this project's own checks)
  bun test             # unit tests
  ```
  Unfixable Biome errors, a failing custom check, type errors, a non-zero
  `display-case check`, or failing tests abort the commit.
- **`.husky/pre-push`** — runs the browser-backed end-to-end suite:
  ```bash
  bun run e2e
  ```
  The a11y and visual phases of `display-case check` are browser-backed too; they
  are part of the broader review/e2e gate rather than the per-commit hook, so a
  commit never blocks on Chromium being installed (see
  [../docs/testing.md](../docs/testing.md) — *The default backend is lazy and
  optional*).

This husky-based model is the **recommended** gate for the standalone repo. There is
intentionally no PR-CI workflow defined today.

**Residual risk.** Hooks are bypassable (`--no-verify`), absent in a clone where
`bun install` never ran, and skipped entirely for bot/GitHub-web edits and
off-machine merges (the GitHub merge button) — any of which can land unlinted code.
If that ever matters, the aligned backstop is the same commands above run in a CI
step on the default branch, not a parallel PR workflow.

---

## 2. Running it

```bash
bun run lint                                        # biome (check) + custom checks
bun run lint:fix                                   # biome (--write) + custom checks (--fix); matches pre-commit
bun run lint:checks                                # just the custom checks (tools/lint)
bun run typecheck                                  # tsc --noEmit (one tsconfig)
bun run check                                      # display-case --structure --tokens --ssr (no browser)
display-case check .                               # everything, including a11y + visual (needs Chromium)
```

- **`biome check --write` fixes by default** — it matches `pre-commit`, which
  auto-fixes and re-stages. Drop `--write` to verify without touching files.
- **`--structure --tokens --ssr` is the browser-free subset.** Naming those three
  phases runs only them; with no phase flag, `display-case check` also runs the
  a11y and visual phases, which need the Playwright/axe toolchain. See
  [../docs/testing.md](../docs/testing.md).

---

## 3. The checks

| Check | Enforces | Scope | Escape |
|---|---|---|---|
| `biome` | Formatting + recommended lint rules, plus the tuned rules below | all files (per `biome.json`) | `// biome-ignore <rule>: <reason>` |
| `display-case --structure` | Static best-practice rules over the showcase: coverage (`*.case.tsx` + `*.placard.md`), catalog integrity (levels, slugs, flows, tweak defaults), case-content (`interactive-cases-keyed`), and opt-in composition rules. Severity-graded: `error` fails, `warn` is non-fatal unless `--strict`. | `roots` from `display-case.config.ts` | `// display-case: allow-<rule-id> <reason>` (also `no-case` / `no-placard` / `allow-orphan` / `unclassified`), per-path `ignore` globs, or per-rule `false`/`'warn'`. Full rule list & escapes: [../docs/testing.md](../docs/testing.md) — *Structure checks* |
| `display-case --tokens` | Every `var(--token)` in the package resolves to a custom property the package defines (in `globalStyles` or an inline `style` object) — catches foreign/typo'd token names that silently fall back. Static parse, no browser. | package source (component CSS/TSX **and** case files) | `allow: unknown-token` on the line or the line above, or the config's `tokens.allow` list. Detail: [../docs/testing.md](../docs/testing.md) — *Token conformance* |
| `display-case --ssr` | Every case renders on the server (`renderToString`, no browser) — keeps a case's render pure, so browser-only APIs stay in effects/handlers. A `browserOnly` case is counted, not flagged. | all discovered cases | declare the component `browserOnly` in its case meta. Detail: [../docs/testing.md](../docs/testing.md) |
| `types` | `tsc --noEmit` — one tsconfig for the whole package | all `.ts`/`.tsx` | — |
| `biome` plugin: e2e locators | e2e specs must not call `getByText()`/`getByRole()` — drive the chrome via `getByTestId(DcTestIds.*)` (see [testing-best-practices.md](testing-best-practices.md) §6). GritQL plugin [tools/lint/e2e-locators.grit](../tools/lint/e2e-locators.grit), scoped to `e2e/**` by a `biome.json` override; runs in `biome check`. | `e2e/**` | `// biome-ignore lint/plugin: <reason>` on the line |
| `biome` plugin: no inline svg | No inline `<svg>` in the browse chrome — the Vitrine design system is "Unicode glyphs only". AST name-match, so `<svgPath>`/`<Svg>` are not flagged. GritQL plugin [tools/lint/no-custom-svg.grit](../tools/lint/no-custom-svg.grit), scoped to `src/ui/**`; runs in `biome check`. | `src/ui/**` | `// biome-ignore lint/plugin: <reason>` (in JSX, immediately before the element) |
| `spec-purity` | No implementation/tool names in a behavior spec; bullet `GIVEN/WHEN/THEN`, not bolded (`--fix` converts bolded keywords) | `openspec/specs/**/spec.md` | `<!-- allow: <reason> -->` on the line |

`spec-purity` is the one remaining **script** check (it scans Markdown, which a
GritQL JS plugin can't) — it lives in [`tools/lint/`](../tools/lint/) and runs via
`bun run lint:checks`. The two AST-pattern rules (e2e locators, no inline `<svg>`)
are Biome **GritQL plugins** that run inside `biome check`.

> **OpenSpec structural validity** (required sections, ≥1 scenario per requirement)
> is the OpenSpec CLI's job (`openspec validate`), not duplicated here. The CLI
> isn't a repo dependency, so it isn't wired into the default gate; run it ad hoc
> if you have it installed. `spec-purity` owns only the project-specific
> conventions the CLI doesn't know (forbidden terms, bullet scenario format).

### What `biome.json` enforces

The shipped `biome.json` keeps Biome's `recommended` set plus these tuned rules. The
effective rule set a contributor sees:

- `noExplicitAny` — **off** (pragmatic; `any` is allowed).
- `noUnusedImports`, `noUnusedVariables` — **error**.
- `noReExportAll` — **error**, except in `index.ts` / `index.tsx` barrels.
- `noDefaultExport` — **error**, except in `*.case.tsx`, `display-case.config.ts`,
  `*.d.ts`, and `playwright.config.ts` (these legitimately default-export).
- `noNestedTernary`, `noNonNullAssertion`, `noParameterAssign`,
  `useConsistentBuiltinInstantiation` — **error**.
- `useImportType` — **error** (type-only imports must use `import type`).
- `useNamingConvention` — **error** (object-literal property names exempted).
- `noRestrictedImports` — **error** for the optional visual toolchain
  (`playwright`, `@axe-core/playwright`, `pixelmatch`, `pngjs`): these must be
  loaded **lazily** via `await import()` so browsing/manifest/render stay
  dependency-light. `src/checks/providers/**` is exempted (the lazy leaves that may
  statically import them). This is the Biome-expressed form of the monorepo's
  `import-boundaries` check — see [coding-best-practices.md](coding-best-practices.md) §6.
- Two **GritQL plugins** run via `overrides[].plugins` (custom messages,
  suppress with `// biome-ignore lint/plugin: <reason>`):
  [e2e-locators.grit](../tools/lint/e2e-locators.grit) (`e2e/**`) forbids
  `getByText()`/`getByRole()`; [no-custom-svg.grit](../tools/lint/no-custom-svg.grit)
  (`src/ui/**`) forbids inline `<svg>`.
- Imports are auto-organized (assist `organizeImports`).

Formatting: 2-space indent, 80-col width, single quotes (double in JSX), trailing
commas, no semicolons, always-parenthesized arrows.

> The host monorepo's `apps/*` overrides (e.g. `noConsole` in app source,
> route-file exemptions) are **dropped** in the standalone config — they referenced
> packages that don't exist here.

---

## 4. Adding a new check

Pick the cheapest home that fits — in this order:

1. **A Biome rule or GritQL plugin.** Prefer Biome over anything custom whenever
   the rule fits. A built-in rule is best (e.g. `noRestrictedImports` for the lazy
   toolchain) — one config line, no maintenance. For an AST pattern with no
   built-in rule (e.g. the `getByText`/`getByRole` ban, or the inline-`<svg>`
   ban), write a small **GritQL plugin** (`*.grit`) and reference it from
   `biome.json` `plugins` (scope it with an `overrides[].plugins` entry); it runs
   inside `biome check` with a custom message and `// biome-ignore lint/plugin:`
   suppression. GritQL fits call/member/JSX-element patterns cleanly; reach for a
   script (below) when the rule must match text inside string literals or span
   non-JS files (e.g. `spec-purity` over Markdown).
2. **A Display Case structure rule.** Rules about the *showcase* (coverage, catalog
   integrity, case content, composition) extend the structure phase in
   [src/checks/structure-check.ts](../src/checks/structure-check.ts). Add the rule there, give it a
   stable `<rule-id>` (so `// display-case: allow-<rule-id>` works), assign a
   severity (`error`/`warn`), and add a unit test next to it
   (`structure-check.test.ts`).
3. **A custom check in [`tools/lint/`](../tools/lint/).** For a cross-cutting rule
   over files the above don't cover (the `e2e/` specs, the OpenSpec specs, chrome
   source) and that Biome can't express. Write `tools/lint/<name>.ts` — scan with
   `Bun.Glob`, print `path:line: message` to stderr, `process.exit(1)` on any
   violation, and honor a `// allow: <reason>` (or `<!-- allow: -->`) escape — then
   add `'<name>'` to the `CHECKS` array in [tools/lint/index.ts](../tools/lint/index.ts).

A new rule that is fundamentally about TypeScript types belongs in the type system
(`tsc --noEmit`), not a separate scanner.

---

## 5. See also

- [coding-best-practices.md](coding-best-practices.md) — the coding rules several of
  these checks enforce (import-type discipline, default-export policy, SSR-pure
  render).
- [testing-best-practices.md](testing-best-practices.md) — test conventions and the
  e2e locator discipline (the `getByText`/`getByRole` half is enforced by the
  Biome GritQL plugin `tools/lint/e2e-locators.grit`).
- [../docs/testing.md](../docs/testing.md) — the product reference for
  `display-case check`: the full structure rule list, token conformance, SSR, and
  the a11y/visual phases, with every per-rule escape.
