## Why

Display Case only runs as a localhost dev server: a watcher, an on-demand rebuilder, a live-reload stream, and no production output. Teams that want to host their showcase — a shared design-system reference beyond one laptop — have nowhere to deploy. The isolated case render and the placard already pre-render before scripts run, but the **browse shell** (the landing surface and every `/c/...` deep link) is still client-only, so a hosted root would serve an empty page until JS boots. This change adds a `publish` command that builds a self-contained, hostable artifact (a production server plus optimized bundle, and an optional fully-static export), and completes the deferred **shell SSR** that a meaningful hosted landing/browse experience requires.

## What Changes

- **Complete shell SSR (the deferred work, in full).** Server-render the browse shell from the in-memory manifest and the requested route, so the landing surface and every `/c/<component>/<case>` deep link arrive with their component tree, selected case, and chrome already painted — then hydrate for interaction. Inline the catalog the first paint needs so the shell no longer waits on a `/manifest.json` round-trip. The stage iframe (whose case is already pre-rendered) and the live-reload/a11y machinery stay client-side, layered on after hydration.
- **Add a `publish` command** that produces a self-contained, deployable build of a showcase, hostable independently of the dev server. It pre-renders every address before scripting (consistent with the existing rendering), ships production-optimized, content-addressed assets, and excludes all development-only behavior — no file watching, no on-demand rebuild, no live-reload stream, no development-only endpoints.
- **Production server form (default).** Emit a lean server entry that serves the pre-rendered documents and assets with hosting-appropriate caching and a health signal, plus the minimal manifest and container recipe to run it standalone — deployable like any other service.
- **Static export form (`--static`).** Optionally crawl every address and write complete HTML files plus the hydration bundle, so the showcase can be hosted with no running server at all; address-encoded tweak variations resolve client-side on hydrate.
- **Reconcile the development-only posture.** Display Case stays out of every *consuming* application's build; the published showcase is its own, separate, explicitly-built artifact.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `display-case`: the browse shell now delivers its content before scripting (extending pre-scripting rendering to every surface), and a new `publish` command builds a self-contained, hostable artifact — a production server plus optimized bundle, with an optional fully-static export — that serves the showcase without any development machinery.

## Impact

- **Spec**: `openspec/specs/display-case/spec.md` — MODIFIES "Pre-scripting rendered content" (adds the browsing surface) and "Development-only tool" (carves out the standalone published build); ADDS "Deployable build".
- **Package** `packages/display-case`: a server-side shell renderer + hydration-safe `Shell`/`use-shell` seeded from an inlined manifest and the request route (`src/ui/shell.tsx`, `src/ui/use-shell.ts`, `src/ui/browser-entry.tsx`, `src/server.ts`); a production bundling path (minified, content-hashed, no dev injects); the `publish` command and production server entry (`src/cli.ts`, new `src/publish.ts` + `src/prod-server.ts`); an optional static crawler/export; generated run recipe (minimal `package.json` + `Dockerfile`).
- **Snapshots & checks**: the visual-regression baselines must be re-confirmed for the shell once it pre-renders; isolated render and placard output are unchanged.
- **Consumers**: no change to authoring. Showcases opt in by running `display-case publish`. The dev server is unchanged.
- **No consuming application artifact is affected** — Display Case remains absent from every product build; the published showcase is a separate artifact a team chooses to deploy.
