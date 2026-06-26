---
name: land-pr
description: >
  Land an approved Display Case pull request end to end — archive its OpenSpec
  proposal (and sync the spec deltas) if one was used, wait for CI to go green on
  the archive push, squash-merge with an encompassing commit message, delete the
  worktree and local branch, then wait for the release workflow and fast-forward
  the main checkout to the published version. Use when asked to "land this PR",
  "land the PR", "merge and release", "ship this PR", or "land #<n>".
---

Take a reviewed, approved PR and drive it all the way to a released `main`. This
skill is the mechanical landing sequence — it does **not** review the change
(that's [`pr-review`](../pr-review)) or decide the version bump (that's
[`display-case-changeset`](../display-case-changeset)). Run those first if needed.

Releases here are automated (Changesets, publish-on-merge — see
[`contributing/releasing.md`](../../../contributing/releasing.md)), so "landing"
isn't just clicking merge: an OpenSpec proposal must be archived before it can
merge (the [merge guard](../../../tools/openspec-merge-guard.ts) blocks active
proposals), and after merge the release workflow pushes a version commit straight
to `main` that the local main checkout must catch up to.

## Preconditions (verify, don't assume)

- **You're in the PR's worktree.** `gh pr view --json number,title,state,baseRefName,headRefName,mergeable,isDraft`
  resolves the PR from the current branch. Confirm it's `OPEN`, not a draft, base
  is `main`, and `mergeable` is `MERGEABLE`. If it's `CONFLICTING`, stop — the
  branch needs a rebase/merge of `main` first.
- **The change is approved / the user intends to land it.** This skill assumes
  that decision is made; it does not gate on review state beyond confirming the
  PR is mergeable.
- **A changeset exists.** `ls .changeset/*.md` (ignore `README.md`). CI's
  `Changeset present` check blocks the merge otherwise; an *empty* changeset is
  the correct opt-out for a no-release change. If none, run
  [`display-case-changeset`](../display-case-changeset) first.
- **Working tree is clean.** `git status -s`. Commit or stash stray edits before
  starting.

Note the **main checkout** path now — you'll need it for the last steps, and the
worktree you're standing in will be gone by then:

```bash
MAIN="$(git worktree list --porcelain | awk '/^worktree /{print $2; exit}')"   # first entry = primary checkout
PR="$(gh pr view --json number -q .number)"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
WT="$(git rev-parse --show-toplevel)"
```

## Steps

### 1. Archive the OpenSpec proposal (only if one was used)

Detect whether this PR was driven by an OpenSpec proposal:

```bash
bun run openspec list                                          # active (unarchived) changes
git diff --name-only origin/main...HEAD -- openspec/changes/ | grep -v '/archive/'   # proposal dirs this PR touched
```

- **No active change / no proposal dir in the diff →** skip to step 2. (Tooling,
  bugfix, and doc PRs often have no proposal — that's normal.)
- **One active change that this PR introduced →** archive it. `openspec archive`
  *both* syncs the delta specs into `openspec/specs/` **and** moves the proposal
  to `openspec/changes/archive/YYYY-MM-DD-<name>/`:

  ```bash
  bun run openspec archive <name> -y
  ```

  Use `--skip-specs` only when the change carries no delta specs (pure tooling /
  docs). For the prompt-driven, warning-aware variant see
  [`openspec-archive-change`](../openspec-archive-change).
- **More than one active change →** archive each one whose directory appears in
  this PR's diff; if it's ambiguous which belong to this PR, ask the user.

Commit the archive (spec sync + the moved proposal) and push to the PR branch:

```bash
git add -A
git commit -m "chore: archive <name>"
git push
```

The merge guard now passes (no active proposal remains in the diff), and the
synced `openspec/specs/` changes ride in on the same merge.

### 2. Wait for CI to go green

The push re-triggers CI (and a new push cancels any in-flight run — `ci.yml`
sets `cancel-in-progress`). Watch the **current** run to completion:

```bash
gh pr checks "$PR" --watch --fail-fast
```

It blocks until every check finishes (exit `0` = all passed). **If anything
fails, stop here** — fix the failure on the branch, push, and re-watch. Do not
merge a red PR. If you skipped step 1 (no new push), still run this to confirm
the existing checks are green before merging.

### 3. Squash & merge with an encompassing commit message

`main` is **squash-only**, so the whole PR collapses to one commit — write a
message that stands on its own in `git log`, not a terse "merge PR". Synthesize
it from the PR title/body, the changeset description, and the diff:

- **Subject:** a conventional-commit line summarizing the *whole* change
  (`feat:` / `fix:` / `chore:` / `docs:` / `refactor:` …), imperative, ~70 chars.
- **Body:** a short paragraph or a few bullets — what changed and why it matters;
  reference the issue it closes (`Closes #<n>`) if any. This is the permanent
  record of the change on `main`.

```bash
gh pr merge "$PR" --squash \
  --subject "feat: <encompassing summary>" \
  --body "$(cat <<'EOF'
- <key change 1>
- <key change 2>

Closes #<issue>
EOF
)"
```

Versioning is decoupled from this message (the changeset file drives the
release), so the subject prefix is for human readability, not the bump level.
The remote branch auto-deletes on merge (`deleteBranchOnMerge` is on) — don't
pass `--delete-branch`; the local cleanup is step 4.

### 4. Delete the worktree and local branch

The remote branch is already gone. Remove the **local** worktree + branch —
**from the main checkout**, because you can't remove the worktree you're standing
in (this also moves the session's cwd out of the doomed directory):

```bash
git -C "$MAIN" worktree remove "$WT"
git -C "$MAIN" branch -D "$BRANCH"
```

If a hook or the harness owns this worktree session, prefer `ExitWorktree` with
`action: "remove"` to tear it down cleanly. After this your previous cwd no
longer exists — run everything below with `git -C "$MAIN"`.

### 5. Wait for the release workflow, then fast-forward `main`

The merge pushed to `main`, triggering [`release.yml`](../../../.github/workflows/release.yml).
If the merged change carried releasable changesets, that workflow versions +
publishes and pushes a **second** commit, `chore(release): version packages
[skip ci]`, directly to `main`. Wait for it before syncing, so the local checkout
lands on the *published* version, not just the squash commit.

Find the release run for the merge commit and watch it:

```bash
MERGE_SHA="$(gh pr view "$PR" --json mergeCommit -q .mergeCommit.oid)"
# Poll until the release run for this SHA exists, then watch it to completion:
RUN_ID="$(gh run list --workflow=release.yml --branch=main \
  --json databaseId,headSha -q "[.[] | select(.headSha==\"$MERGE_SHA\")][0].databaseId")"
gh run watch "$RUN_ID" --exit-status
```

(The run can take a few seconds to appear — re-query `RUN_ID` until it's
non-empty.) An empty/no-release PR still triggers the workflow; it just no-ops
and pushes no version commit — that's fine, fast-forward anyway.

Fast-forward the main checkout to the final `main` (squash commit + any version
commit):

```bash
git -C "$MAIN" fetch origin main
git -C "$MAIN" merge --ff-only origin/main
git -C "$MAIN" log --oneline -3        # confirm the squash + (optional) release commit
```

`--ff-only` is deliberate: the local `main` should never have diverged. If it
*won't* fast-forward, stop and report — something pushed to the local `main`
out of band; don't force it.

## Done

Report: the merge commit, the released version (from the release run / the new
`chore(release)` commit, or "no release — empty changeset"), and that the
worktree + local branch are gone and the main checkout is fast-forwarded.

## Guardrails

- **Never merge red.** Step 2 must pass before step 3.
- **Archive before merge.** An unarchived OpenSpec proposal fails the merge
  guard; spec deltas must be synced + committed, not left in the proposal.
- **One commit, real message.** Squash subject + body must describe the whole
  change — it's the only history `main` keeps.
- **Clean up from the main checkout**, never from inside the worktree being
  removed.
- **Fast-forward only.** Don't reconcile a diverged local `main` by merging or
  forcing — investigate instead.
- This skill **lands** an already-reviewed PR; it doesn't review it
  ([`pr-review`](../pr-review)) or author the changeset
  ([`display-case-changeset`](../display-case-changeset)).
