---
"@awarebydefault/display-case": minor
---

Harden the publish path and add a bundle-graph budget check.

- **`publish` now runs every bundle in a fresh child process** (the same crash-contained build worker the dev server uses), so publishing a large showcase can no longer accumulate Bun bundler heap state and segfault mid-build. A surface whose bundling crashes the bundler fails publish with a clear, attributed diagnostic and a non-zero exit instead of a native panic — covering the host-served, `--static`, and SSR forms. Per-component builds also run concurrently through a bounded pool.
- **New `display-case check --graph` phase**: measures each component's real bundled module graph and warns when it exceeds a budget or when one dependency dominates it (a barrel import, e.g. importing a whole icon set), naming the offending package. Budgets are configurable via `check.graphBudget` (`modules`/`perPackage`); warnings escalate to errors under `--strict`. It builds each component in isolation, so it runs in a no-flag full check but is excluded from the fast `--structure --tokens --ssr` gate.
