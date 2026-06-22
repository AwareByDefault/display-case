---
name: display-case-changeset
description: >
  Create or update the Changeset that declares a PR's release impact — the bump
  level (patch/minor/major) and the CHANGELOG description — by inspecting the
  branch's diff against its base. Use when adding a changeset, when the
  "Changeset present" PR check fails, or when asked to "add a changeset",
  "declare the release", or "what version bump is this".
---

Display Case versions releases with [Changesets](https://github.com/changesets/changesets):
every PR declares its own release impact in a `.changeset/*.md` file, and CI's
`Changeset present` check fails any PR that adds none. This skill writes (or
updates) that file from the actual changes on the branch.

## Steps

1. **Read the change.** Find the base (default `main`) and inspect the diff:
   `git diff --stat "origin/main...HEAD"`, then `git diff "origin/main...HEAD" -- src`
   for the substance. Judge *user-facing* impact — ignore tooling-only churn
   (CI, docs, tests, internal refactors) when deciding the level.
2. **Decide the bump** against the public surface (`src/index.ts` —
   `defineCases`/`defineFlow`/`tweak`/`defineConfig`; the `./tokens-check` and
   `./prod-server` exports; the `display-case` CLI behavior):
   - **major** — a breaking change to that public surface or CLI (renamed/removed
     export or option, changed output/contract).
   - **minor** — a backward-compatible new capability (new flag, export, or
     case/check feature).
   - **patch** — a bug fix or internal change with no API change.
   - **no release** — docs / CI / tests / refactor only → an *empty* changeset.
3. **Check for an existing changeset** first: `ls .changeset/*.md` (ignore
   `README.md`). If this PR already has one, **update** its level/description
   rather than adding a second.
4. **Write it.** Prefer the CLI — `bun run changeset` (interactive) or
   `bun run changeset --empty` for a no-release change — or write the file
   directly as `.changeset/<two-words>.md`:
   ```md
   ---
   "@awarebydefault/display-case": minor
   ---

   Add a `--static` flag to `display-case publish` for a server-less export.
   ```
5. **Description discipline** — write for the CHANGELOG reader (a package
   consumer), not as a commit log: what changed and why it matters, imperative,
   one or two sentences, naming the public flag/export. A `major` should say what
   breaks and how to migrate.
6. **Verify**: `bun run changeset:status` shows the resulting release; the PR diff
   vs base now adds a `.changeset/*.md`, so `Changeset present` will pass.

## Notes

- The frontmatter package name is `@awarebydefault/display-case` (the npm scope),
  **not** the `display-case` bin/CLI name.
- Bump = the highest across all changesets in the PR; multiple changesets are
  fine and each becomes its own changelog line.
- Versioning is decoupled from commit messages — the changeset file is the source
  of truth, so merge style doesn't affect the release (`main` is squash-only).
- Full release flow: [`../../../contributing/releasing.md`](../../../contributing/releasing.md).
