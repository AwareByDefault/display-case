---
---

Bump the `actions/setup-node` GitHub Action from 6 to 7 in the release workflow.
This action only runs in CI (it provides the Node/npm used for the pinned
`npm publish` provenance step) — it is not part of the published package or its
runtime. No release impact.
