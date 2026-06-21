## 1. Author-facing live updates

- [x] 1.1 Watch case files, `.prompt.md` documentation, and placard content; rebuild on change while Display Case runs.
- [x] 1.2 Push the rebuilt result to the open browsing surface and preserve the active selection where it still exists.

## 2. Opt-in dev mode for the tool itself

- [x] 2.1 Add a `--dev` flag to `src/cli.ts` that additionally live-reloads Display Case's own app (chrome, design-system components, placard).
- [x] 2.2 Serve a long-lived `/__livereload` SSE stream (`src/server.ts`) the page subscribes to, and override its default idle timeout so the stream stays open.
- [x] 2.3 Add the `bun dev` package script that runs the CLI with `--dev`; do not wrap in `bun --watch` (re-invoking the bundler inside a watch process corrupts module resolution).

## 3. Verification

- [x] 3.1 Verify editing a selected case updates the surface without a restart and keeps it selected; verify adding a new case file makes it appear without a restart.
- [x] 3.2 Verify `bun dev` reloads on edits to the tool's own chrome/design-system/placard; confirm a backend edit needs a manual restart with the page auto-reloading on the reconnect that follows.

## 4. Docs

- [x] 4.1 Document the two reload scopes (default author content vs `--dev` tool app vs manual-restart backend) in `packages/display-case/README.md`.
