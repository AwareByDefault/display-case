## Why

Authoring for Display Case is an edit-and-look loop: write a case, adjust its documentation, tweak the placard, look at the result. Forcing a manual restart on every edit breaks that loop and makes the tool feel inert. The browsing surface should reflect author-facing edits as they happen. Separately, contributors working on Display Case *itself* (its chrome, design-system styling, the placard layout) had no live feedback at all — those edits are not case content, so the ordinary authoring watcher does not pick them up — which made iterating on the tool slow.

## What Changes

- While Display Case is running, **author-facing edits** — adding or changing a case, a component's usage documentation, or placard content — are **reflected on the browsing surface without a manual restart**, preserving the current selection where it still exists.
- Add an opt-in **dev mode** that additionally live-reloads Display Case's *own* app (chrome, design-system components, placard) for contributors working on the tool, via a long-lived reload stream the page subscribes to.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `display-case`: requires author-facing edits (cases, usage documentation, placard) to be reflected on the running browsing surface without a manual restart, preserving the active selection.

## Impact

- **Spec**: `openspec/specs/display-case/spec.md` — adds "Live authoring updates".
- **Package** `packages/display-case`: the authoring watcher that rebuilds on case/prompt/placard changes and the live-update path that preserves selection; the opt-in `--dev` flag and the `/__livereload` SSE stream the page subscribes to (`src/cli.ts`, `src/server.ts`); the `bun dev` package script.
- **Scope note**: the ordinary watcher covers author-facing content; the tool's own backend (server, discovery) still needs a manual restart, with the page auto-reloading on the reconnect that follows. Not wrapped in `bun --watch` — re-invoking the bundler inside a watch process corrupts module resolution.
- **Consumers**: no behaviour change for deployed apps. No production application artifact is affected — Display Case remains development-only.
