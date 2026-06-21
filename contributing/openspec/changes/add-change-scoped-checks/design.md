## Context

`display-case check --a11y --visual` renders and audits every case. On a PR
that is almost all wasted work. We want to scope the render phases to the
components a change could have affected, soundly. This capability is consumed by
the PR CI workflow (`add-pr-ci-workflow`), which runs a11y + visual with
`--changed` against the PR base.

A complication specific to this repo: component CSS is **concatenated and inlined
globally** into every rendered document (the server's `readVitrineCss` globs all
component `*.css`), and components do not JS-import their own stylesheet. So a JS
import graph alone neither sees colocated CSS nor captures that a CSS edit cascades
across every component. The design must account for that.

## Goals / Non-Goals

**Goals:**
- Cut CI render work to the components a change could affect.
- Never silently skip a component a change *did* affect (soundness > efficiency).
- Keep it dependency-light — no bundler/module-graph dependency.
- Opt-in; default behavior (check everything) is unchanged.

**Non-Goals:**
- Scoping the static phases (structure/tokens/ssr) — already cheap.
- A perfect module graph (bare/package imports are not traced; see Decisions).
- Per-*case* scoping — granularity is the component.

## Decisions

- **Import closure by relative-specifier walk, not a bundler.** `Bun.build`
  exposes no metafile, and a showcase is dependency-light, so `src/core/affected.ts`
  walks `import`/`export … from`/dynamic-import/`require` and CSS `@import`
  specifiers, following only **relative** ones, resolving with the usual
  extension/index candidates. Bare specifiers (`react`, `display-case`) are not
  traced: a PR essentially never edits a node_modules package, and tracing them
  would pull the whole framework into every closure. Source-level regex, not a
  parser — adequate for a dependency walk and free of a parse dependency.
- **Attribution + a conservative global fallback.** A changed file in exactly
  one component's closure scopes to that component. A render-relevant changed
  file that **no** closure claims — globally-inlined CSS (the case above), the
  render pipeline, shared `src/`, the primer — cannot be proven component-local,
  so it scopes to **every** component. This is what makes change-scoping sound
  for the global-CSS architecture: a CSS edit lands as "unattributed" and
  correctly fans out to all. Verified: editing one component's `.css` scopes to
  all 35; editing its `.tsx` scopes to just it.
- **Render-relevance filter so docs/tests/CI scope to nothing.** Only
  `.tsx/.ts/.jsx/.js/.css/.mdx` under the package, excluding test files and the
  `contributing/ docs/ e2e/ skills/ scripts/ tools/ .github/ .claude/` trees,
  can affect a render. A PR touching only those scopes to zero components and the
  render phases pass without booting a browser — the main CI win. Without this
  filter, a docs-only change would hit the global fallback and re-check
  everything.
- **Change detection unions committed + working-tree diffs.** `git diff
  <ref>...HEAD` (merge-base) ∪ `git diff HEAD` so CI sees the PR's commits and a
  local run also sees uncommitted edits. An unresolvable ref (over-shallow clone)
  yields no changes → nothing affected; CI must fetch enough history (the
  workflow checks out with adequate depth and passes the base sha).
- **Two selectors, intersected when combined.** `--only=<ids/globs>` (explicit)
  and `--changed[=ref]` (git-derived, ref also via `DISPLAY_CASE_BASE_REF`,
  default the base branch). Given both, a component must satisfy both. Either
  present ⇒ an empty result short-circuits before any browser work.
- **Scope lives in the check runner, the graph in core.** `src/core/affected.ts`
  stays pure and unit-tested (closures, attribution); `src/checks/check.ts` owns
  git, the render-relevance filter, and the global fallback (it has the package
  root and config). Keeps the inward import direction (checks → core).

## Risks / Trade-offs

- [Untraced bare imports miss a dep that changed via a package] → In practice a
  PR edits in-repo source, not node_modules; and any in-repo shared module is
  reached by a relative path, so it is traced (or hits the global fallback).
- [Regex import extraction misreads commented-out/string imports] → Over- not
  under-detection (an extra edge only widens scope), so it stays sound; never
  drops a real edge that would shrink scope.
- [Stale base ref / shallow clone yields empty diff → under-scope] → CI fetches
  full history and passes the base sha explicitly; a resolvable ref is required
  for a trustworthy scoped run.
