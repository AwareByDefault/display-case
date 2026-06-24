---
---

Repo tooling and process only — no change to the published package (`src/`, the
exports, the CLI, or the bundled consumer skills), so this is a no-release
changeset. This PR:

- adds the adversarial `pr-review` agent skill under `.claude/skills/`;
- adds an `openspec` CI merge-guard (`tools/openspec-merge-guard.ts`) that blocks
  an unarchived OpenSpec proposal from landing on `main`, with unit tests;
- adds unit tests for the `spec-purity` lint, run via `bun run test:tools`;
- removes the commitlint commit-msg hook now that releases are Changeset-driven;
- archives the `add-pr-ci-workflow` and `add-change-scoped-checks` OpenSpec
  proposals (folding their spec deltas into `openspec/specs/`).
