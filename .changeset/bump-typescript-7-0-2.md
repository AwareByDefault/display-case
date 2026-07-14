---
---

Bump the `typescript` dev dependency from 6.0.3 to 7.0.2. TypeScript is only used
by the repo's own `tsc --noEmit` typecheck gate — it is not part of the published
runtime, and consumers type-check the shipped source with their own TypeScript
version. No release impact.
