---
"@awarebydefault/display-case": patch
---

Fix a segfault when running the dev server (`--dev`) against a large showcase.
Per-component bundling alone wasn't enough: the long-lived server still ran Bun's
bundler in-process (the browse-chrome build), and the bundler's heap state
accumulating in that process is what corrupts and crashes ("a bug in Bun, not your
code") on a large catalog.

Now **all** Bun bundling — the chrome build and every per-case build — runs in a
fresh, short-lived child process whose heap dies with it (the same isolation the
manifest load already used); the server only orchestrates and serves the bytes.
The server never calls the bundler itself, so it can't accumulate the heap state
that crashes. A bundler crash on any surface is contained and reported (the tool
keeps running, the chrome falls back to a diagnostic) instead of taking the whole
process down with a native panic.

Build concurrency is bounded (`DISPLAY_CASE_BUILD_CONCURRENCY`), and the preview
frame now loads just after the chrome rather than blocking the initial page load,
so a first-visit build never stalls navigation. Set `DISPLAY_CASE_TRACE=1` to log
startup build/manifest timings.
