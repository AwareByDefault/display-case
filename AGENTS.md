# AI Agent Guidelines

Guidelines for AI agents (and humans) contributing to **Display Case** — a
Bun-native, AI-friendly component showcase, a lightweight alternative to
Storybook.

Display Case requires **Bun**. Prefer `bun` over `python`/`node` when executing
scripts in this repository.

> **Two audiences, two doc trees.** [`docs/`](docs/) is the **product
> documentation** — how to *use* Display Case (write cases, configure, theme,
> check, publish). [`contributing/`](contributing/) is the **repository's own**
> engineering guide — how to *work on* Display Case (best practices, OpenSpec
> specs, worktree-safe execution). When in doubt: using the tool → `docs/`;
> changing the tool → `contributing/`.

---

## What Display Case is

A per-package dev tool: colocate `*.case.tsx` files next to your components, run
one command, and browse every variant in an isolated preview. No Vite, no
Webpack, no config server — discovery, bundling, and serving are all done with
Bun's built-in bundler and `Bun.serve`. It is strictly a development tool and is
never bundled into a consuming app build.

The repo **dogfoods itself**: its own browse chrome has a design system — "The
Vitrine" — under [`src/ui/design-system/`](src/ui/design-system/), and
[`display-case.config.ts`](display-case.config.ts) points the showcase at those
components. Full product overview: [README.md](README.md).

## Display Case (for agents)

Browse the component showcase with `bun run display-case`; `--print-manifest`
lists every component/case as JSON (no server or browser needed).
Snapshot one case in isolation at `/render/<component>/<case>?theme=light|dark`
(chrome-free HTML). Build a hostable showcase with
`display-case publish <pkgDir> [--out=] [--base=] [--static]` — a production
server + content-hashed bundle (or `--static` for a server-less export). Every
surface (shell, render, primer) is server-rendered before scripts; no dev
machinery is carried into the build.

See [display-case.prompt.md](display-case.prompt.md) for case authoring and
[docs/ai-agents.md](docs/ai-agents.md) for the full agent workflow (the
enumerate → snapshot → verify loop). The bundled agent skills under
[`skills/`](skills/) (`display-case-snapshot`, `display-case-author-case`,
`display-case-author-placard-doc`, `display-case-review`) are what
`display-case init` installs into a consuming repo.

---

## Engineering discipline

### Coding conventions

See **[contributing/coding-best-practices.md](contributing/coding-best-practices.md)**
for TypeScript conventions, module/CLI structure, the central **render-purity /
SSR-determinism** rule, case-authoring rules (lazy thunks, keyed interactive
wrappers), design-token vocabulary, and import boundaries.

### Testing

See **[contributing/testing-best-practices.md](contributing/testing-best-practices.md)**
for the test layers (`bun test` units, the Playwright `e2e/` chrome suite, and
`display-case check`'s phases), the e2e locator discipline (`src/ui/test-ids.ts`),
and the no-sleep rule.

### Linting

See **[contributing/linting-best-practices.md](contributing/linting-best-practices.md)**
for the gate — Biome + `tsc --noEmit` + `display-case check --structure --tokens
--ssr` — how it's wired into git hooks, and the per-check escape hatches.

```bash
bun run setup        # first-time: deps + the Playwright Chromium browser (idempotent)
bun run lint         # biome check
bun run typecheck    # tsc --noEmit
bun run check        # display-case static checks (structure + tokens + ssr)
bun test             # unit / type tests
bun run e2e          # Playwright chrome suite (setup installs the browser)
```

Do not skip or suppress lint errors. Fix the root cause.

### Worktree-safe execution

Display Case holds **no global or main-repo state** — resolution, the
`.display-case/` build cache, and repo-relative paths all anchor to the package
you point it at, so an agent working in a `git worktree` (an isolated checkout)
stays entirely inside that worktree and two checkouts never clobber each other's
output. Launch it from inside the worktree (cwd within the checkout) or pass a
worktree path explicitly. Full account:
[contributing/worktree-safe-execution.md](contributing/worktree-safe-execution.md);
the `lint-in-worktree`, `test-in-worktree`, and `run-e2e` skills handle the
`node_modules` setup a fresh worktree needs.

---

## Spec/design discipline

This project uses **OpenSpec**: a strict separation between **what the system
does** (behavior, in [`contributing/openspec/specs/`](contributing/openspec/specs/))
and **how it does it** (implementation, in each change's `design.md` under
[`contributing/openspec/changes/`](contributing/openspec/changes/)).

### Spec rules

- `contributing/openspec/specs/{capability}/spec.md` describes **observable
  behavior only**. Use RFC 2119 keywords (SHALL/MUST/SHOULD/MAY). Scenarios use
  bulleted `GIVEN`/`WHEN`/`THEN`/`AND` — not bolded prose.
- No library, framework, class, file, or function names in `spec.md`. A spec
  should survive a stack migration unchanged.
- Implementation detail belongs in `contributing/openspec/changes/{change}/design.md`.

The behavior is split across discrete capability specs (discovery, case
authoring, tweaks, flows, rendering, checks, publishing, …) — see
[contributing/openspec/specs/README.md](contributing/openspec/specs/README.md)
for the map. The full change history lives under
[`contributing/openspec/changes/archive/`](contributing/openspec/changes/archive/).

### Workflow

1. Propose: `/openspec:propose "{name and intent}"`. Hand-edit until `design.md`
   pins the consequential decisions.
2. Validate: `openspec validate {change-name}`.
3. Implement: `/openspec:apply {change-name}`.
4. Verify: run tests + the static checks, hit the running showcase, confirm
   scenarios pass.
5. Archive: `/openspec:archive {change-name}`.
6. Post-change review: update any of
   `contributing/coding-best-practices.md`,
   `contributing/testing-best-practices.md`,
   `contributing/NOTES.md`, the product `docs/`, or `README.md` that the change
   affected. Skip files genuinely unaffected; don't add noise.

---

## Core philosophy

Display Case exists so a component can be browsed, snapshotted, and verified in
isolation — by a human or a machine — without booting an app.

### Do

- Keep render **pure and deterministic** (the server renders before scripts).
- Make every surface **machine-readable** (manifest + deterministic render URLs).
- Stay **dependency-light** and lazy-load the optional visual toolchain.
- Let the showcased component own the visual weight; keep the chrome quiet.

### Don't

- Pull a consuming app's code, runtime, or state into the tool.
- Add browser-only work to a case's render path (use a tweak or `browserOnly`).
- Carry dev machinery into a published build.

---

## AI Agent Notes

Maintain **[contributing/NOTES.md](contributing/NOTES.md)** — record non-obvious
patterns, debugging solutions, quirks/edge cases, and useful context that isn't
appropriate for code comments. Update it whenever you discover something a future
agent or developer would otherwise have to rediscover.
