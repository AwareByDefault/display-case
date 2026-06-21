## 1. Import-closure analysis

- [ ] 1.1 Add `src/core/affected.ts`: transitive relative-import + CSS `@import` closure for a set of entry files, with extension/index resolution and bare-specifier skipping.
- [ ] 1.2 Expose `componentClosures` (id → closure) and `affectedComponents` (attribution).
- [ ] 1.3 Unit-test closures, attribution, shared-dependency fan-out, missing entries, and bare-specifier exclusion (`src/core/affected.test.ts`).

## 2. Scope resolution in the check runner

- [ ] 2.1 Add `only?: string[]` and `changedRef?: string` to `CheckOptions`.
- [ ] 2.2 Compute changed files since a ref (`git diff <ref>...HEAD` ∪ `git diff HEAD`), tolerating an unavailable git / unresolvable ref.
- [ ] 2.3 Add the render-relevance filter (extension allowlist; exclude tests, docs, specs, e2e, tooling trees).
- [ ] 2.4 Resolve the change-derived scope: attribute claimed files to components; an unattributed render-relevant change ⇒ all components; no render-relevant change ⇒ none.
- [ ] 2.5 Resolve the explicit scope (`--only` ids/globs); intersect when both selectors are present.
- [ ] 2.6 Filter the a11y/visual targets to the scope; short-circuit (no browser) when the scope is empty.

## 3. CLI

- [ ] 3.1 Parse `--only=<csv>` and `--changed[=ref]` in `src/cli.ts`; honor `DISPLAY_CASE_BASE_REF`; update the usage banner.

## 4. Verify

- [ ] 4.1 Confirm a component-local `.tsx` change scopes to one component, a `.css` change scopes to all, and a docs-only change scopes to none.
- [ ] 4.2 Run lint, typecheck, and `bun test`.

## 5. Documentation

- [ ] 5.1 `openspec/specs/README.md` and `openspec/config.yaml` — add the `change-scoped-checks` capability.
- [ ] 5.2 `docs/testing.md` and `docs/cli.md` — document `--only` / `--changed` and the soundness rules.
- [ ] 5.3 `contributing/NOTES.md` — record the global-CSS fan-out rule and why scoping falls back to all on unattributed render inputs.
