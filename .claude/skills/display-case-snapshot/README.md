# display-case-snapshot

Render and screenshot a single component variant in isolation — in light and dark — without booting the app.

## What it does

Resolves a component's case from the Display Case manifest, builds the deterministic `/render/<component>/<case>?theme=…&t.<tweak>=…` URL, and captures the chrome-free HTML with a headless browser. Because the full state lives in the URL, the same inputs always produce the same image.

## When it triggers

"Show me the Button", "screenshot the Alert error state", "what does the survey form look like in dark mode", or any request to see/capture a component's appearance for review.

## How it works

1. Ensure `bun run display-case` is running (port 3100).
2. Read `/manifest.json` (or `--print-manifest`) to find the case's `renderUrl` and `tweaks`.
3. Append `theme`, optional `width`, and `t.<name>` params.
4. Screenshot the page with a headless browser, light and dark.

See [`../../docs/ai-agents.md`](../../docs/ai-agents.md) for the endpoint reference.
