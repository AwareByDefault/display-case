## Context

Display Case (from `add-display-case`) already exposes an AI-friendly surface: `/manifest.json` (a directory of file references), a deterministic chrome-free `/render/<c>/<case>?theme=…` endpoint, and `--print-manifest`. What's missing is *enablement*: a consuming repo must hand-wire a launch entry, the agent must be taught the manifest→render→snapshot loop from scratch each time, and the agent docs under-specify operation. This change ships the wiring (`init`), the reusable know-how (skills), and completes the docs. It depends on `add-display-case` and must be applied after it.

## Goals / Non-Goals

**Goals:**
- One idempotent command (`display-case init`) that makes a repo AI-native: launch entry + skills + guide pointer, plus a matching `display-case uninstall` that reverses exactly those.
- Merge-aware, re-runnable, non-destructive writes (and owns-only removals) with a clear per-artifact report.
- Pluggable agent targets, shipping **Claude Code** first.
- Bundled, reusable skills (snapshot, author-case, review-checks).
- Complete the agent docs: tool-level `.prompt.md` + start/rasterize mechanics.

**Non-Goals:**
- Not shipping non-Claude targets in this change (leave the seam, don't fill it).
- Not auto-running `init` on `bun install` (explicit, operator-invoked).
- No change to the runtime tool surface (manifest/render/check unchanged).

## Decisions

### D1 — `init` is a subcommand of the existing CLI

`display-case init [pkgDir] [--agent claude] [--dry-run] [--json]` joins the existing `cli.ts` dispatch (`dev`, `check`, `--print-manifest`). `pkgDir` (the showcased package) defaults to the cwd-resolved package; the **target repo** for scaffolding is the repo root (git-root walk, as the server already does). `--dry-run` prints the planned actions without writing; `--json` emits the plan/report as JSON (human-readable by default). `uninstall` takes the same flags. **Alternative considered:** a separate `create-display-case` binary — rejected; the tool is already invoked via one CLI and a subcommand keeps discovery simple.

### D2 — Agent targets are a small strategy table

An `AgentTarget` describes where a given agent keeps things:
```ts
interface AgentTarget {
  id: 'claude'
  launchConfigPath: string   // .claude/launch.json
  skillsDir: string          // .claude/skills/
  instructionsFile: string   // AGENTS.md if present, else CLAUDE.md
  // merge/format helpers for that agent's launch-config shape
}
```
Only `claude` is implemented now; the table is the seam for `cursor`, etc. An unknown `--agent` fails fast, writing nothing. **Why a table over per-agent branches:** keeps `init`'s logic agent-agnostic (plan → write), so adding a target is data, not new control flow.

### D3 — Idempotent, merge-aware writes

`init` computes a *plan* of artifacts, each tagged `create | update | skip`, then applies it. Rules:
- **`.claude/launch.json`**: parse if present (else start `{version, configurations: []}`); add the `display-case` configuration only if no entry with that `name` exists; if present but stale, update in place; never touch other entries. Mirrors the schema already in this repo's `launch.json`.
- **Skills**: copy each bundled skill dir into `<skillsDir>/<skill>/`; skip ones already present and identical, update ones that differ (by content hash), never delete unknown skills.
- **Instructions pointer**: append a small, fenced "Display Case (for agents)" block to the instructions file only if a sentinel marker isn't already present; the marker makes re-runs idempotent.

Everything is reported (`created`/`updated`/`skipped`) and `--dry-run` shows the plan without applying. **Alternative considered:** templating/overwriting whole files — rejected; operators own these files, so merge-with-sentinel is the safe contract.

### D4 — Bundled skills live in the package and are the install payload

Each skill ships as a directory `packages/display-case/skills/<skill>/` containing **both** a `SKILL.md` (agent-facing: `name` + `description` frontmatter + instructions, the file the agent loads) and a `README.md` (human-facing: what the skill does, when it triggers, how it works) — matching this repo's existing skill convention (cavecrew, caveman-*, etc. all pair the two). `init` copies the whole directory verbatim, so the README travels with the skill into the target repo. Initial set:
- **`display-case-snapshot`** — given a component (+ optional theme/tweaks), ensure the server is up, resolve `renderUrl` from the manifest, capture light/dark, report.
- **`display-case-author-case`** — scaffold a `*.case.tsx` for a component missing one (reads the component's props; pairs with the `display-case-coverage` lint).
- **`display-case-review`** — run `display-case check`, parse a11y/visual output, propose fixes.

These encode the manifest→render→snapshot loop once so agents don't re-derive it. They reference the tool's own endpoints/CLI, so they travel with any repo `init` touches.

### D5 — Complete the agent docs

- Add `packages/display-case/display-case.prompt.md` — the terse, always-loaded agent reference: the loop in ~20 lines (enumerate via `--print-manifest`, snapshot via `/render?theme=`, verify via `check`), pointing to `docs/ai-agents.md` for depth. This is the file `init`'s instructions-pointer links to.
- Extend `docs/ai-agents.md` with the missing mechanics: starting the server headlessly (`bun run display-case`, the port, `--print-manifest` needs no server), and that `/render` returns **HTML** so rasterizing needs a headless browser (Playwright/preview) — with a concrete capture example. Also document the `--json` plan output as the agent-friendly way to consume `init`/`uninstall` results.
- Add an **installation / agent-setup section to the root `README.md`** explaining `display-case init` and `uninstall`: what each writes/removes, the `--agent`, `--dry-run`, and `--json` flags (human-readable default, JSON on request), and the idempotent/owns-only guarantees — written so both a human operator and an agent can read it and understand exactly what the commands do.

### D6 — `uninstall` is the symmetric inverse, owns-only

`display-case uninstall [pkgDir] [--agent claude] [--dry-run]` runs the same plan/apply engine in reverse, removing **only** artifacts Display Case owns — identified the same way `init` writes them, so the two stay in lock-step:
- **`.claude/launch.json`**: remove the configuration whose `name` is `display-case`; leave every other entry; if removal empties `configurations`, keep the file with an empty array rather than deleting it. Never touches a file `init` never wrote to.
- **Skills**: remove only directories whose names match the **bundled skill ids** (the install payload); never remove operator-authored skills, even adjacent ones.
- **Instructions pointer**: delete the block delimited by the sentinel markers `init` wrote; if the markers are absent, do nothing.

Each removal is reported (`removed | skipped`), `--dry-run` shows the plan, and a run on a never-installed repo reports "nothing to remove" and exits cleanly. The sentinel markers and the fixed launch `name`/skill ids are exactly what make owns-only removal safe — there's no guessing about what belonged to Display Case. **Alternative considered:** recording an install manifest to know what to remove — rejected as overkill; stable names + sentinels are sufficient and survive hand-edits.

## Risks / Trade-offs

- **Editing operator-owned files** (`launch.json`, `AGENTS.md`) → mitigated by parse-merge-with-sentinel, `--dry-run`, never deleting, and a per-artifact report; a malformed existing `launch.json` aborts with a clear message rather than overwriting.
- **Skill drift between repos** (`init` copies, so updates don't propagate) → acceptable for v1; re-running `init` updates changed skills by content hash. A future `--update-skills` could formalize it.
- **Cross-agent scope creep** → deliberately ship only `claude`; the strategy table contains the blast radius.
- **Skills duplicated in this repo** (the package ships skills, and this repo already has a `.claude/skills/`) → running `init` here would install them locally too; that's expected dogfooding, and idempotency keeps it clean.

## Migration Plan

1. Add the `AgentTarget` table + plan/apply engine and wire `init` and `uninstall` into `cli.ts`.
2. Author the three bundled skills under `packages/display-case/skills/`.
3. Add the tool `.prompt.md` and extend `docs/ai-agents.md`.
4. Dogfood: run `display-case init` in this repo; confirm idempotent re-run; confirm `display-case uninstall` removes exactly what was added and leaves existing skills/entries intact; commit the resulting `.claude/` additions.

Rollback: remove the `init`/`uninstall` commands, the `skills/` dir, and the doc additions; any scaffolded files in consuming repos can be removed with `display-case uninstall` (or deleted by hand).

## Open Questions

_None outstanding._

**Resolved:**
- **Instructions file target** → write the pointer to `AGENTS.md` when present, else fall back to `CLAUDE.md`. Encoded in the `claude` `AgentTarget` (D2); `uninstall` resolves the same file the same way.
- **Machine-readable plan output** → `init` and `uninstall` accept a `--json` flag that emits the plan/report (each artifact + its `created|updated|skipped|removed` action) as JSON for agent consumption; output is **human-readable by default**. The README/installation guide documents both forms for humans and agents (D5).
