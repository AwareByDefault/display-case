---
---

Repo tooling only — no package change. Adds the adversarial `pr-review` skill
(`.claude/skills/`), an `openspec` CI merge-guard that blocks unarchived
proposals from landing on main, and removes the commitlint commit-msg hook now
that releases are Changeset-driven.
