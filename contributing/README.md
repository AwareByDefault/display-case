# Contributing to Display Case

This directory is the **repository's own engineering guide** — how to *work on*
Display Case. It is deliberately separate from [`../docs/`](../docs/), which is
the **product documentation** (how to *use* Display Case to showcase your own
components).

Start with the root [AGENTS.md](../AGENTS.md) for the high-level map; the files
here are the detail.

## Best practices

- **[coding-best-practices.md](coding-best-practices.md)** — TypeScript
  conventions, module/CLI structure, the central render-purity / SSR-determinism
  rule, case-authoring rules, design-token vocabulary, import boundaries.
- **[testing-best-practices.md](testing-best-practices.md)** — the test layers
  (`bun test`, the Playwright `e2e/` chrome suite, `display-case check`), e2e
  locator discipline, the no-sleep rule, isolation.
- **[linting-best-practices.md](linting-best-practices.md)** — the gate (Biome +
  `tsc` + the static `display-case` checks), how it's wired into git hooks, and
  per-check escape hatches.
- **[releasing.md](releasing.md)** — how versions and npm publishes happen
  (semantic-release on `main`), the Conventional-Commit requirement, and the
  one-time `NPM_TOKEN` / package-name setup.

## Working safely

- **[worktree-safe-execution.md](worktree-safe-execution.md)** — why and how
  Display Case runs cleanly inside an isolated `git worktree`, and the
  `node_modules` setup a fresh worktree needs.

## Engineering notes

- **[NOTES.md](NOTES.md)** — non-obvious decisions, debugging notes, and
  architectural context, newest first. Maintain it as you discover things.

## Specifications (OpenSpec)

- **[openspec/specs/](openspec/specs/)** — the behavior spec, split into discrete
  per-capability files (see [openspec/specs/README.md](openspec/specs/README.md)).
- **[openspec/changes/](openspec/changes/)** — proposed and archived changes
  (each with `proposal.md`, `design.md`, `tasks.md`, and spec deltas). The
  archive is the full design history of the tool.
- **[openspec/config.yaml](openspec/config.yaml)** — domain, capability map,
  vocabulary, and non-negotiable rules (the authoritative spec context).

The OpenSpec workflow (`/openspec:propose` → `apply` → `archive`) is described in
[AGENTS.md](../AGENTS.md#specdesign-discipline); the commands live in
`../.claude/commands/opsx/` and the matching skills in `../.claude/skills/`.
