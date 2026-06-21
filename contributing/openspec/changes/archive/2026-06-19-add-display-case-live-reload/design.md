## Context

Display Case serves a built bundle and watches the showcase's authored material. There are two distinct audiences for "reload": the **author** editing cases/docs/placard in a consumer package, and the **contributor** editing Display Case's own app source. They want different scopes, so the design separates them.

## Goals

- Author edits to cases, usage docs, and placard reflect on the surface without a manual restart, keeping the current selection.
- Contributors iterating on the tool itself get live reload too, without paying that cost in the default path.

## Decisions

### Default watcher covers author-facing content only
The ordinary run watches case files, `.prompt.md` documentation, and placard content and rebuilds on change, pushing the update to the open surface and preserving the active selection where it still exists. This is the author loop and is on by default. It deliberately does **not** watch the tool's own app source — that is a contributor concern with a different lifecycle.

### Opt-in `--dev` for the tool's own app
A `--dev` flag (`src/cli.ts`) additionally live-reloads Display Case's own app — chrome, design-system components, placard layout. The page subscribes to a long-lived `/__livereload` SSE stream (`src/server.ts`); on rebuild the stream signals and the page reloads. The `bun dev` package script runs the CLI with `--dev`. Keeping it opt-in means ordinary authoring runs don't carry the extra watch surface.

### Not wrapped in `bun --watch`
Re-invoking the bundler inside a `bun --watch` process corrupts module resolution, so dev mode drives its own rebuild rather than relying on `bun --watch`. Backend edits (server, discovery) still require a manual restart; the page auto-reloads on the reconnect that follows, so the recovery is a single step.

### SSE idle timeout
The `/__livereload` stream is long-lived, so the server overrides its default short idle timeout for that path (`src/server.ts`) to keep the stream open.

## Risks / Trade-offs

- **Two reload scopes** could confuse. Mitigated by documenting the split: default = author content; `--dev` = the tool itself; backend = manual restart.
- **SSE reconnect as the recovery path** for backend edits is slightly implicit. Documented in the README so contributors expect the reconnect-driven reload.

## Migration

None — additive. The author watcher already existed for cases; this change states it as observable behaviour and adds the opt-in `--dev` reload for the tool's own app.
