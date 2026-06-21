## 1. Init engine

- [x] 1.1 Add an `AgentTarget` strategy table (`src/agents.ts`) describing per-agent paths/merge helpers; implement the `claude` target (`.claude/launch.json`, `.claude/skills/`, `AGENTS.md`/`CLAUDE.md`).
- [x] 1.2 Implement a plan/apply engine (`src/init.ts`): compute a plan of artifacts each tagged `create | update | skip`, then apply; resolve the target repo via the existing git-root walk.
- [x] 1.3 `.claude/launch.json` merge: parse-or-init, add the `display-case` configuration only if absent (match by `name`), update if stale, preserve all other entries; abort with a clear message on malformed JSON.
- [x] 1.4 Skills install: copy each bundled skill dir into the target `skillsDir`, skipping identical and updating changed (content hash), never deleting unknown skills.
- [x] 1.5 Instructions pointer: resolve the instructions file as `AGENTS.md` if present, else `CLAUDE.md`; append a sentinel-marked "Display Case (for agents)" block only when the sentinel is absent (idempotent). `uninstall` resolves the same file the same way.
- [x] 1.6 Implement owns-only removal (the inverse plan): drop the `display-case` launch entry (preserve others; keep the file with empty `configurations` if emptied), remove only directories matching the bundled skill ids, and delete the sentinel-delimited instructions block; each artifact tagged `removed | skipped`.

## 2. CLI wiring

- [x] 2.1 Add `display-case init [pkgDir] [--agent claude] [--dry-run]` to `src/cli.ts`; default agent `claude`; unknown `--agent` fails fast writing nothing.
- [x] 2.2 Add `display-case uninstall [pkgDir] [--agent claude] [--dry-run]` to `src/cli.ts` (same agent selection + dry-run semantics).
- [x] 2.3 `--dry-run` prints the planned actions without writing/removing; normal runs print a per-artifact `created | updated | skipped` (init) or `removed | skipped` (uninstall) report — human-readable by default.
- [x] 2.4 Add `--json` to both commands: emit the plan/report as structured JSON (per artifact + action) for agent consumption; human-readable remains the default.

## 3. Bundled skills

Each skill ships as a directory with **both** a `SKILL.md` (agent-facing, `name`/`description` frontmatter) and a `README.md` (human-facing what/when/how), matching the repo convention.

- [x] 3.1 `packages/display-case/skills/display-case-snapshot/` (`SKILL.md` + `README.md`) — manifest → `renderUrl` → light/dark capture for a named component.
- [x] 3.2 `packages/display-case/skills/display-case-author-case/` (`SKILL.md` + `README.md`) — scaffold a `*.case.tsx` for an uncovered component (reads its props; pairs with the coverage lint).
- [x] 3.3 `packages/display-case/skills/display-case-review/` (`SKILL.md` + `README.md`) — run `display-case check`, parse a11y/visual output, propose fixes.

## 4. Agent docs

- [x] 4.1 Extend `packages/display-case/display-case.prompt.md` (the case-authoring reference shipped with `add-display-case`) with the terse agent-operation loop — enumerate (`--print-manifest`) → snapshot (`/render?theme=`) → verify (`check`) — linking to `docs/ai-agents.md`.
- [x] 4.2 Extend `docs/ai-agents.md`: how to start the server headlessly (port, `--print-manifest` needs no server), that `/render` returns HTML (rasterize with a headless browser) with a concrete capture example, and the `--json` plan output for consuming `init`/`uninstall` results.
- [x] 4.3 Add an installation / agent-setup section to the root `README.md` explaining `display-case init` and `uninstall`: what each writes/removes, the `--agent`/`--dry-run`/`--json` flags (human-readable default, JSON on request), and the idempotent + owns-only guarantees — readable by both humans and agents.

## 5. Verification

- [x] 5.1 Run `display-case init --dry-run` in this repo; confirm the plan lists the launch entry, skills, and instructions pointer.
- [x] 5.2 Run `display-case init`; confirm `.claude/launch.json` gains a `display-case` entry without disturbing existing ones, skills land in `.claude/skills/`, and the instructions pointer is added.
- [x] 5.3 Re-run `display-case init`; confirm it reports everything as skipped/updated with no duplicates (idempotent).
- [x] 5.4 Run `display-case init --agent cursor` (unsupported); confirm it fails clearly and writes nothing.
- [x] 5.5 Add an operator-authored launch entry + a hand-made skill, then run `display-case uninstall`; confirm the `display-case` entry, bundled skills, and pointer block are removed while the operator-authored entry and skill remain.
- [x] 5.6 Re-run `display-case uninstall` on the now-clean repo; confirm it reports "nothing to remove" and changes nothing.
- [x] 5.7 Run `bun run lint` and type checks; `openspec validate add-display-case-agent-init --strict`.
