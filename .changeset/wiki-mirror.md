---
---

Add a GitHub wiki mirror of the docs. `tools/wiki/generate.ts` turns the in-repo
`docs/` and `contributing/` markdown into wiki-compatible pages, and a
`wiki-sync` workflow regenerates and pushes them to the repo's wiki on every push
to `main` that touches the docs. The repo stays the source of truth (it ships in
the package and is what AI agents read); the wiki is a generated, human-browsable
mirror that cannot drift. No package code or published surface changes — no release.
