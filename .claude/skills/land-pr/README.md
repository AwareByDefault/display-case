# land-pr

Land an approved PR end to end — archive, merge, clean up, release, sync.

## What it does

Drives a reviewed, mergeable PR all the way to a released `main`: archives its
OpenSpec proposal and syncs the spec deltas (only if a proposal was used), waits
for CI to go green on the archive push, squash-merges with an encompassing commit
message, deletes the local worktree and branch (the remote branch auto-deletes on
merge), then waits for the release workflow to publish + push its version commit
and fast-forwards the main checkout to it.

## When it triggers

"Land this PR", "land #<n>", "merge and release", "ship this PR" — for a PR that
is already reviewed and ready.

## How it works

1. Verify preconditions: open, non-draft, `MERGEABLE`, has a changeset, clean tree.
2. If an OpenSpec proposal drove the work, `openspec archive <name>` (syncs delta
   specs + archives), commit, push.
3. `gh pr checks --watch --fail-fast` — never merge red.
4. `gh pr merge --squash` with a real subject + body (the only history `main` keeps).
5. `git worktree remove` + `git branch -D` from the main checkout.
6. `gh run watch` the release run, then `git merge --ff-only origin/main`.

It does **not** review the change ([`pr-review`](../pr-review)) or write the
changeset ([`display-case-changeset`](../display-case-changeset)) — run those
first. Release model: [`../../../contributing/releasing.md`](../../../contributing/releasing.md).
