---
---

ci: cut a GitHub Release for each published version. The release workflow now runs `gh release create v<version>` after pushing the tag, using that version's `CHANGELOG.md` section as the notes (`changeset publish` creates the git tag but never a GitHub Release). No-release CI change.
