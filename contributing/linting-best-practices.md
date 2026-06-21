# Linting Best Practices

The authoritative reference for this repo's linting: how it's gated, how to run it,
what every check enforces, and how to add a new one. Other docs link here rather
than restating it.

This is a single-package repo (`display-case`). The realistic quality gate is
**Biome** (format + lint), **`tsc --noEmit`** (types), this project's **own static
checks** via `display-case check --structure --tokens --ssr`, plus the **OpenSpec**
spec checks that travel with `contributing/openspec/specs/**`. There is no custom
multi-check lint runner driving over a dozen packages — that machinery belonged to
the monorepo this package came from and does not exist here.

---

## 1. How linting is gated

Quality gates run through **git hooks (husky)**, not a separate CI lint job.

- **`.husky/pre-commit`** — on commits that touch code (not docs/specs only), runs
  the static, browser-free gate:
  ```bash
  bunx biome check --write .                          # format + lint, auto-fix + re-stage
  tsc --noEmit                                         # types
  bun test                                             # unit tests
  display-case check . --structure --tokens --ssr      # this project's own static checks
  ```
  Unfixable Biome errors, type errors, failing tests, or a non-zero
  `display-case check` abort the commit.
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
bunx biome check --write .                         # format + lint, fixes in place
bunx biome check .                                 # check only, no mutation (verify / CI)
tsc --noEmit                                        # type-check (one tsconfig)
display-case check . --structure --tokens --ssr     # the project's static gate, no browser
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
| `spec-purity` | No implementation-detail terms; bullet `GIVEN/WHEN/THEN`, not bolded | `contributing/openspec/specs/**/spec.md` | `<!-- allow: <reason> -->` |
| `spec-validate` | OpenSpec structural validity: required sections, ≥1 scenario per requirement, no stray `## ADDED/MODIFIED Requirements` headers | `contributing/openspec/specs/**` (via OpenSpec) | — |

`spec-purity` vs `spec-validate`: purity owns the **project-specific** conventions
OpenSpec doesn't know about (forbidden terms, bullet scenario format); validate owns
**structural** validity. They're complementary, not redundant.

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
- Imports are auto-organized (assist `organizeImports`).

Formatting: 2-space indent, 80-col width, single quotes (double in JSX), trailing
commas, no semicolons, always-parenthesized arrows.

> The host monorepo's `apps/*` overrides (e.g. `noConsole` in app source,
> route-file exemptions) are **dropped** in the standalone config — they referenced
> packages that don't exist here.

---

## 4. Adding a new check

Most rules belong in one of two places — neither is a new bespoke runner:

1. **A Biome rule.** Prefer tightening `biome.json` over a custom check whenever the
   rule is expressible as a Biome rule — one config line covers the whole package
   with no maintenance, and it's already wired into the hook.
2. **A Display Case structure rule.** Rules about the showcase (coverage, catalog
   integrity, case content, composition) extend the structure phase in
   [src/structure-check.ts](../src/structure-check.ts). Add the rule there, give it a
   stable `<rule-id>` (so `// display-case: allow-<rule-id>` works), assign a
   severity (`error`/`warn`), and add a unit test next to it
   (`structure-check.test.ts`) — checks are infra that can silently rot.

A new rule that is fundamentally about TypeScript types belongs in the type system
(`tsc --noEmit`), not a separate scanner.

---

## 5. See also

- [coding-best-practices.md](coding-best-practices.md) — the coding rules several of
  these checks enforce (import-type discipline, default-export policy, SSR-pure
  render).
- [testing-best-practices.md](testing-best-practices.md) — test conventions and the
  e2e locator discipline (locator rules live there, not in a lint check).
- [../docs/testing.md](../docs/testing.md) — the product reference for
  `display-case check`: the full structure rule list, token conformance, SSR, and
  the a11y/visual phases, with every per-rule escape.
