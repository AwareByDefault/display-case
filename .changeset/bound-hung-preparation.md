---
"@awarebydefault/display-case": patch
---

Bound a hung surface preparation. A build worker (or the `--print-manifest`
subprocess) that neither completes nor crashes — a never-resolving top-level
`await`, a spinning plugin — previously held its bounded concurrency slot forever,
silently wedging all further preparation while the server still answered `/health`.
Each preparation now has a generous, configurable time bound
(`DISPLAY_CASE_BUILD_TIMEOUT`, default 120s): on expiry the worker is killed and the
hang is reported as a contained per-surface failure (distinct from a bundler crash),
the slot is released, and the tool keeps serving every other surface. Extends the
`scalable-serving` "isolated, diagnosed preparation failure" guarantee from two
failure modes (logical build error; bundler crash) to three (adds a hang).
