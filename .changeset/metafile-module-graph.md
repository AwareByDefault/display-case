---
'@awarebydefault/display-case': patch
---

Fix a bundler crash when a component imports a file-loader asset (image/font/etc.)
with a used value binding. Display Case's build worker collected the module graph
with a pass-through `onLoad` observer plugin, which — combined with such an asset —
tripped a Bun 1.3.14 use-after-free in the parallel chunk linker
(`generateChunksInParallel`), hard-crashing the dev `/render`, `publish`, and graph
check for that component. The graph is now read from Bun's native build `metafile`
instead of an `onLoad` hook, removing the trigger. The graph check's crash message
no longer misattributes such crashes to an oversized graph; it names both possible
causes (an oversized graph or a Bun linker bug).
