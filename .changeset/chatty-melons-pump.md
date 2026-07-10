---
---

CI-only: the release workflow now treats a push carrying only empty (no-release)
changesets as a no-op — it consumes the changeset files but skips `changeset
publish`, so a no-release PR can no longer trigger a failed release run. Not a
published change.
