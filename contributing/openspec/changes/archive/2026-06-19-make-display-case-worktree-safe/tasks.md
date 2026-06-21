## 1. Resolution

- [x] 1.1 Implement `discoverConfigDir(start)` in `src/cli.ts`: walk up from `start` (bounded) and return the nearest ancestor containing `display-case.config.ts`, else null.
- [x] 1.2 Implement `resolvePkgDir(arg)`: an explicit target is used as given and must contain the config (fail loudly otherwise); the default (no arg or `.`) discovers from `process.cwd()`.
- [x] 1.3 Remove the old install-location (`import.meta.dir` / "installed") heuristic so the bare form and `.` are one mode.

## 2. State isolation

- [x] 2.1 Anchor the `.display-case/` build cache and all repo-relative paths to the resolved package directory, so two checkouts never share a cache.
- [x] 2.2 Honour `DISPLAY_CASE_PORT` (set per-worktree by the dev orchestrator) when no explicit `--port` is given, and let the server bump off a busy port rather than hard-fail.

## 3. Verification

- [x] 3.1 Verify running from a package root, from a subdirectory, and from two parallel checkouts each resolves and caches within its own tree.
- [x] 3.2 Verify an explicit path with no `display-case.config.ts` fails with a clear message and does not fall back.

## 4. Docs

- [x] 4.1 Document the single rule in `packages/display-case/README.md` (run from inside the checkout, or pass a path explicitly; don't rely on a sibling-checkout cwd) and note worktree-safe-by-default in the AI-agent section.
- [x] 4.2 Tell consumers to always pass a target (avoid a bare `bunx` whose cwd is unclear).
