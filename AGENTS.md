# AI Agent Guidelines

Guidelines for AI agents (and humans) contributing to **Display Case** — a
Bun-native, AI-friendly component showcase, a lightweight alternative to
Storybook.

Display Case requires **Bun**. Prefer `bun` over `python`/`node` when executing
scripts in this repository.

> **Two audiences, two doc trees.** [`docs/`](docs/) is the **product
> documentation** — how to *use* Display Case (write cases, configure, theme,
> check, publish). [`contributing/`](contributing/) is the **repository's own**
> engineering guide — how to *work on* Display Case (best practices,
> worktree-safe execution). When in doubt: using the tool → `docs/`;
> changing the tool → `contributing/`. The OpenSpec workspace
> ([`openspec/`](openspec/)) is the one exception that sits at the repo root, not
> under `contributing/`, so its CLI works out of the box (see Spec/design
> discipline).

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

## Source layout

`src/` is grouped by concern; tests are colocated (`*.test.ts` next to the module).
The two entry files sit at the root, everything else lives under a named group:

```
src/
  index.ts        Public authoring API (the "." export): defineCases/defineFlow/tweak/defineConfig + types
  cli.ts          The bin entry; dispatches to commands/ and checks/
  core/           Data model + discovery: catalog, manifest, discovery, mdx-plugin
  render/         Server-side rendering: ssr-render/shell/primer, render-node, the HTML documents
  server/         The hosts: dev server + prod-server (the "./prod-server" export)
  checks/         `display-case check` phases: check (runner), structure/tokens/ssr/check-text,
                  a11y-scanner, and providers/ (the lazy, optional visual toolchain)
  commands/       CLI subcommands: init (agent scaffolding), publish, agents
  ui/             The browse chrome + the Vitrine design system (its own internal structure)
  testing/        Shared test scaffolding (test-helpers)
  types/          Ambient module declarations (*.d.ts)
```

The public surface is small and deliberate: only `index.ts`, `checks/tokens-check.ts`
(`./tokens-check`), and `server/prod-server.ts` (`./prod-server`) are exported (see
`package.json` `exports`); everything else is internal. Imports point "inward"
(commands/server/checks → render/core → index); keep that direction.

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

### Releasing (Changesets)

Versioning and npm publishing are automated with
[Changesets](https://github.com/changesets/changesets) — **decoupled from commit
messages**. Every PR **must** include a changeset declaring its release impact, or
CI's `Changeset present` check fails the PR:

```bash
bun run changeset            # patch / minor / major + a CHANGELOG description
bun run changeset --empty    # a no-release change (docs, CI, tests, refactor)
bun run changeset:status     # preview what the pending changesets would release
```

The frontmatter package name is `@awarebydefault/display-case` (the npm scope),
not the `display-case` bin name. On merge to `main`, the release workflow consumes
the changesets, bumps `package.json` + `CHANGELOG.md`, and publishes — pushing the
version commit to `main` as the `awarebydefault-release` GitHub App (the branch
ruleset's bypass actor). Because versioning no longer depends on commit messages,
merge style (squash or rebase — merge commits are disabled) doesn't affect
releases. The [`display-case-changeset`](.claude/skills/display-case-changeset)
skill writes the right changeset from the branch diff. Full flow:
[contributing/releasing.md](contributing/releasing.md).

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
does** (behavior, in [`openspec/specs/`](openspec/specs/))
and **how it does it** (implementation, in each change's `design.md` under
[`openspec/changes/`](openspec/changes/)). The workspace lives at the repo root
(`openspec/`) so the `openspec` CLI works out of the box from anywhere in the
tree; it is pinned as a devDependency, so `bun run openspec <cmd>` (or a direct
`openspec <cmd>`) uses the repo's version. Note `openspec/` is the one part of
the engineering material that sits at the root rather than under `contributing/`,
because the CLI auto-discovers its workspace by walking up from the cwd.

### Spec rules

- `openspec/specs/{capability}/spec.md` describes **observable
  behavior only**. Use RFC 2119 keywords (SHALL/MUST/SHOULD/MAY). Scenarios use
  bulleted `GIVEN`/`WHEN`/`THEN`/`AND` — not bolded prose.
- Structure each spec as `# Title`, a `## Purpose` section (the one-paragraph
  intro), then `## Requirements`. The `## Purpose` + `## Requirements` headers are
  required by the OpenSpec CLI schema (`openspec validate --specs`).
- No library, framework, class, file, or function names in `spec.md`. A spec
  should survive a stack migration unchanged.
- Implementation detail belongs in `openspec/changes/{change}/design.md`.

The behavior is split across discrete capability specs (discovery, case
authoring, tweaks, flows, rendering, checks, publishing, …) — see
[openspec/specs/README.md](openspec/specs/README.md)
for the map. The full change history lives under
[`openspec/changes/archive/`](openspec/changes/archive/).

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
