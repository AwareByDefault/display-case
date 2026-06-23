---
"@awarebydefault/display-case": patch
---

Dev watcher now follows the bundle's module graph, so editing a workspace
sibling resolved to source (an `exports`/`main` pointing at `./src/...` with no
build step) triggers a rebuild and live-reload when viewing it through a
consuming app's cases. Previously only the target package's `src` was watched,
so sibling edits silently served a stale bundle until an unrelated edit inside
the target forced a re-bundle.
