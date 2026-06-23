---
name: pr-review
description: >
  Adversarially review a GitHub pull request against Display Case for code
  quality, completeness, OpenSpec discipline, dogfooding, test coverage, and
  docs — assuming the PR is incomplete until the diff proves otherwise. Posts
  findings as resolvable PR comments and is re-runnable: a second run updates the
  summary, resolves fixed threads, and opens only new ones. Use when given a PR
  URL or number and asked to "review this PR", "do a thorough/adversarial
  review", "re-review / update the review", "is this PR ready to merge", or
  "what's missing in this change".
---

Review a GitHub PR against Display Case's engineering bar. The posture is
**adversarial**: every claim of completeness is guilty until the diff proves it
innocent. Your job is to find what's missing — an undeclared spec change, a
dogfood the change forgot to update, an untested branch, a doc left stale — not
to rubber-stamp. Default each consideration to **fail/unknown** and only mark it
**pass** when you can point at the diff line that satisfies it.

This skill is for reviewing changes *to this repo*. It leans on the repo's own
engineering material: [`contributing/coding-best-practices.md`](../../../contributing/coding-best-practices.md),
[`contributing/testing-best-practices.md`](../../../contributing/testing-best-practices.md),
[`contributing/linting-best-practices.md`](../../../contributing/linting-best-practices.md),
[`contributing/releasing.md`](../../../contributing/releasing.md), the OpenSpec
workspace under [`openspec/`](../../../openspec/), and the root
[`CLAUDE.md`](../../../CLAUDE.md). Cite the specific rule a finding violates
(e.g. "coding §3.1", "testing §6.1").

## Steps

### 1. Pull the PR and build the change-set picture

The PR is the argument under `$1` (a URL like
`https://github.com/.../pull/42` or a bare number). Gather the facts before
judging:

```bash
gh pr view <pr> --json title,body,author,baseRefName,headRefName,files,additions,deletions,state,isDraft,labels,url
gh pr diff <pr>                       # the full unified diff
gh pr checks <pr>                     # CI status (lint / check / test / e2e / Changeset present)
```

Read the **PR body** for the author's stated intent and any linked OpenSpec
change. Read the **whole diff**, not just the summary — group the changed files
by area (`src/index.ts` surface · engine · `src/ui/` chrome · `src/checks/` ·
`openspec/` · `docs/` · `contributing/` · `*.test.ts` · `e2e/` · `.changeset/`).
For a large diff, fan out Explore / general-purpose subagents per area and keep
only their findings here.

**If this session isn't already on the PR branch, review in a dedicated
worktree** — never switch the current checkout's branch out from under the user's
work. Create one and run the whole review (reading files, lint, tests, checks) in
it:

```bash
git worktree add .claude/worktrees/pr-<pr> --detach    # isolated checkout
cd .claude/worktrees/pr-<pr> && gh pr checkout <pr>     # PR head (handles forks too)
```

(Skip this if the session is already on the PR branch.) Static review of the diff
is mandatory; running the gates (`bun run lint` / `typecheck` / `check`,
`bun test`, and `bun run e2e` for chrome) is high-value when the change is
non-trivial. Remove the worktree when done: `git worktree remove .claude/worktrees/pr-<pr>`.

### 2. Classify the change — does it *deserve* an OpenSpec proposal? *(consideration 1)*

OpenSpec separates **what the system does** (behavior, `openspec/specs/`) from
**how** (`design.md`). A change needs a proposal when it **adds, removes, or
alters observable behavior** — a new/changed CLI command, flag, or output; a new
authoring API in `src/index.ts`; a new check phase or rule; a change to the
publish artifact contract; new discovery/rendering semantics. A change does
**not** need one when it is purely internal with no behavior delta — a refactor,
a bug fix that restores already-specified behavior, dependency bumps, docs,
tests, or CI.

- Judge from the diff, **not** the PR's say-so. If behavior moved and there is no
  `openspec/changes/<name>/` in the diff → **finding: missing proposal**.
- If a proposal exists for a change that didn't need one, that's fine (not a
  finding) — but a *bug-fix-shaped* diff carrying a sweeping spec rewrite is a
  smell worth flagging.

### 3. If a proposal exists, audit it for internal completeness *(consideration 2)*

A change folder is `proposal.md` + `design.md` + `tasks.md` +
`specs/<capability>/spec.md`. Check the chain holds together:

- **design ⊇ proposal** — every intent in `proposal.md` has a corresponding
  decision in `design.md`; no consequential decision is left implicit.
- **tasks ⊇ design** — `tasks.md` enumerates the *full* work the design implies.
  Hunt for design decisions with no task, and for "and more" hand-waving.
- **specs ⊇ behavior** — `specs/**/spec.md` captures **every** observable change,
  with RFC-2119 keywords and bulleted `GIVEN/WHEN/THEN` scenarios (≥1 per
  requirement). The spec must contain **no** library/file/function names (that's
  `design.md`'s job; `spec-purity` enforces it). Run `openspec validate <name>`
  if the CLI is available (`bun run openspec validate <name>`).

### 4. If a proposal exists, does the code match it? *(consideration 3)*

Cross-read the diff against `design.md` and `tasks.md`:

- Every `tasks.md` checkbox should be reflected by real changes in the diff (or
  honestly left unchecked). A checked task with no corresponding code is a lie.
- The implementation should follow the design's decisions, not silently diverge.
  A divergence is acceptable **only** if `design.md` was updated to record it —
  otherwise it's a finding (the spec/design and code have drifted).
- Behavior the spec promises should be exercised somewhere (a test, a case, the
  CLI path). Spec'd-but-unbuilt is incomplete.

### 5. Archival — not your job *(consideration 4)*

Don't review whether the change is archived. CI does: the `openspec` merge guard
(`tools/openspec-merge-guard.ts`) **blocks merge** unless the only OpenSpec
content the PR adds/modifies is archived proposals (`openspec/changes/archive/`)
and spec changes (`openspec/specs/`). An open, unarchived proposal during review
is **expected and fine** — it just can't land. So glance at `gh pr checks <pr>`:
a red `OpenSpec merge guard` means "archive before merge" (`bun run openspec
archive <name>`), already enforced — don't restate it as a finding.

### 6. Are the changes reflected in the dogfood? *(consideration 5)*

Display Case dogfoods itself: its browse chrome is built from the Vitrine design
system (`src/ui/design-system/`) and [`display-case.config.ts`](../../../display-case.config.ts)
points the showcase at it. A change that adds a user-facing capability but never
exercises it on the repo's own showcase is half-done.

- New Vitrine component → it needs a `*.case.tsx` (and ideally a `*.placard.md`);
  `case-placard-coverage` enforces this. New authoring API / tweak / flow / check
  → there should be a dogfood usage or a case demonstrating it.
- New config option → consider whether `display-case.config.ts` or the Primer
  (`src/ui/design-system/primer.mdx`) should demonstrate it.
- A feature you can't see working in `bun run display-case` is a feature with no
  proof of life. Note where the dogfood *should* have moved and didn't.

### 7. Unit-test coverage — appropriate, not just present? *(consideration 6)*

`bun test`, colocated `*.test.ts` under `src/` (testing §1–§4). Adversarial bar:

- Every new pure function / engine module / check rule has a colocated test that
  asserts **observable behavior**, named as an assertion (testing §3.2).
- **Error paths are covered**, not only the happy path (loaders return
  `{ modules, errors }` — assert both; testing §3.4). New structure rule → a test
  next to it in `structure-check.test.ts` (linting §4.2).
- Tests are **deterministic** — no `Date.now()`/`Math.random()`/wall-clock/ambient
  env (testing §4). Filesystem code uses real temp dirs, not mocks (§3.3).
- Public type-surface changes carry `*.test-d.ts` assertions where it matters.
- A diff that adds logic but no test, or tests only the sunny path, is a finding.

### 8. E2E coverage — for chrome changes *(consideration 7)*

Playwright `e2e/` specs (`*.spec.ts`) boot a real Display Case server and drive
the browse chrome. The bar applies **when the PR touches `src/ui/` chrome** (a
new surface, nav, panel, control):

- A new reachable surface needs a `data-testid` from `src/ui/test-ids.ts`
  (`DcTestIds`) and an e2e spec that drives it **only** via
  `getByTestId(DcTestIds.*)` — never `getByText`/`getByRole`/CSS/text (testing
  §6, enforced for `getByText`/`getByRole` by a Biome plugin).
- **No sleeps** — wait on conditions/web-first assertions, not `waitForTimeout`
  (testing §7). `retries: 0`, so a flake is a failure.
- Pure engine/CLI/check changes don't need e2e — say so rather than inventing a
  gap. A chrome change with no e2e (or only a unit test where a browser
  interaction is the point) is a finding.

### 9. Code quality, ethos, and best practices *(considerations 8, 9, 10)*

Is this **worth shipping to the world**, and is it true to Display Case?

**Sweep every numbered rule — don't spot-check.** Open all three references and
test the diff against **each** rule in them, not just the famous ones:
- [`contributing/coding-best-practices.md`](../../../contributing/coding-best-practices.md) (§§1–9)
- [`contributing/testing-best-practices.md`](../../../contributing/testing-best-practices.md) (§§1–11)
- [`contributing/linting-best-practices.md`](../../../contributing/linting-best-practices.md) (§3 + the `biome.json` rule list)

For every numbered rule ask "does this diff break it?" On a large diff, fan out
subagents — one per file or section — each returning `{rule, file:line,
violation, fix}` for any breach. Miss none; the rule numbers are stable handles.

**Citing a rule violation — required format.** When a finding breaks a numbered
rule, the comment **leads** with the rule (number + name + a link to its line on
`main`), *then* the one-line what's-wrong and the fix:

> [coding §3.1 Keep render pure](https://github.com/OWNER/REPO/blob/main/contributing/coding-best-practices.md#L68): `Date.now()` in render → adopt mismatch. Pass a fixed tweak.

Resolve the line against the **main branch**, so the link survives the PR's own
edits. Rule anchors are bold and start the line in either form — `**3.1**` or
`**3.1 Colocation.**` — so match the number followed by a space or `*`:
```bash
n=$(git show origin/main:contributing/coding-best-practices.md \
    | grep -nE '^\*\*3\.1[ *]' | head -1 | cut -d: -f1)
echo "https://github.com/$O/$R/blob/main/contributing/coding-best-practices.md#L$n"
```
A finding with **no** numbered rule behind it (a plain bug, a missing test) just
describes the issue — don't manufacture a citation.

**Where to hunt hardest** (rules most often broken here):

- **Render purity / SSR determinism (coding §3)** — the central rule. No
  clock/random/locale/browser API *during render*; browser work lives in
  effects/handlers; non-deterministic values come in as fixed tweaks;
  `browserOnly` is the last-resort opt-out. This is the one to hunt hardest.
- **Public surface (coding §2.3, §1.1)** — `src/index.ts` stays pure data + thin
  helpers, environment-neutral, no `any`. Imports point inward
  (commands/server/checks → render/core → index); no consuming-app imports
  (coding §6.1).
- **Dependency-light (coding §6.2–§6.3)** — a new runtime `dependency` is a
  deliberate, justified decision, not a convenience; the visual toolchain stays
  `optional` and lazily `import()`-ed. A new dep with a Bun/`node:` built-in
  alternative is a finding.
- **Ethos (`CLAUDE.md` "Core philosophy")** — keep render pure & deterministic;
  every surface machine-readable; the chrome quiet so the showcased component
  owns the visual weight; **no** dev machinery carried into a published build;
  **no** consuming-app code pulled into the tool.
- **Conventions** — `import type` (§1.2), no non-null `!` (§1.3), safe index
  access (§1.4), discriminated-union narrowing (§1.6), pure logic split from
  React (§2.4), `--dc-*` token vocabulary in the chrome (§5), loud-and-early
  error handling (§7). Naming/format/lint per `biome.json` (linting §3).
- Confirm the gates pass: `gh pr checks <pr>`, or run `bun run lint`,
  `bun run typecheck`, `bun run check`, `bun test` (and `bun run e2e` for chrome)
  from the checked-out branch. A green-looking PR that fails a gate locally is the
  headline finding. **A change is complete only when unit tests, the static
  checks, and lint all pass, and chrome changes are covered by e2e** (testing
  §10).
- **Changeset (releasing)** — every PR needs a `.changeset/*.md` declaring the
  bump (or an empty one for no-release), or `Changeset present` fails. Sanity-
  check the level against the actual surface impact (major = breaking public
  API/CLI). Defer the write itself to the `display-case-changeset` skill.

### 10. Documentation fully updated? *(consideration 11)*

A behavior change with stale docs is incomplete. Map the change to its docs and
verify each that should have moved did:

- **Product docs** (`docs/`) — `cli.md`, `configuration.md`, `writing-cases.md`,
  `theming.md`, `testing.md`, `ai-agents.md`, etc. A new flag/option/phase that
  isn't in `docs/` is undiscoverable.
- **Engineering docs** (`contributing/`) — a new convention, check, or test layer
  updates the relevant best-practices file (the post-change review step in
  `CLAUDE.md`). New non-obvious pattern → `contributing/NOTES.md`.
- **`README.md`**, the `display-case.prompt.md` authoring guide, the bundled
  `skills/`, and `CLAUDE.md` itself — update whichever the change touched.
- Don't demand doc churn for genuinely doc-irrelevant changes; *do* flag the doc
  that silently went stale.

### 11. Post the review to the PR — idempotently

Findings go **on the PR**, not just back to chat, and the skill is **re-runnable
on the same PR**: a second run reconciles against what the first run posted
rather than duplicating it.

**Inline comments are as short as possible** — the minimum of *what's wrong*
plus a *recommended fix when it's simple*. **≤2 lines is the target**; spend more
only on a genuinely complex problem. No preamble, no restating the diff. Shape:

- Breaks a numbered rule → **lead with the linked rule** (§9 format), then the
  one-liner: `[coding §3.1 Keep render pure](<main-link>): <what's wrong>. <fix>.`
- No rule behind it → `severity: <what's wrong>. <fix>.`

**Resolvable inline comments are ALWAYS preferred.** Every finding that maps to a
changed line goes inline so the author can resolve the thread. Only a finding
with **no** diff line to point at (missing proposal, absent dogfood case, a
stale doc not in the diff) lives solely in the summary — never drop it.

**Markers make re-runs idempotent** (hidden HTML comments, invisible when
rendered):
- The summary is **one issue comment** ending with `<!-- pr-review:summary -->`.
- Each inline finding's comment ends with `<!-- pr-review:finding:<key> -->`,
  where `<key>` is a **stable, line-independent** id — `<rule>@<path>#<anchor>`,
  the anchor a symbol/function name or a 2–3-word slug. Anchor on rule + path +
  symbol, **never** the prose or the line number (both drift), so the same issue
  yields the same key next run.

**Resolve `<owner>/<repo>` once:**
```bash
OR=$(gh repo view --json nameWithOwner -q .nameWithOwner); O=${OR%/*}; R=${OR#*/}
```

**a. Gather prior state** (skip on a clean first run — nothing matches):
```bash
# Our existing inline threads: key, resolved?, top-comment id (for replies), thread node id (to resolve)
gh api graphql -f query='query($o:String!,$r:String!,$p:Int!){repository(owner:$o,name:$r){
  pullRequest(number:$p){reviewThreads(first:100){nodes{
    id isResolved comments(first:1){nodes{databaseId body}}}}}}}' \
  -F o="$O" -F r="$R" -F p=<pr> \
  --jq '.data.repository.pullRequest.reviewThreads.nodes[]
        | select(.comments.nodes[0].body|test("pr-review:finding:"))
        | {thread:.id, resolved:.isResolved, commentId:.comments.nodes[0].databaseId,
           key:(.comments.nodes[0].body|capture("pr-review:finding:(?<k>[^ ]+)").k)}'
# Our summary issue comment id (empty on first run):
SUMMARY_ID=$(gh api "repos/$O/$R/issues/<pr>/comments" --paginate \
  --jq 'map(select(.body|contains("pr-review:summary")))|.[0].id // empty')
```

**b. Reconcile** the current run's code-tied findings (`CURRENT`, by key) against
those prior threads (`PRIOR`, by key):

| | in `CURRENT` | not in `CURRENT` (fixed) |
|---|---|---|
| **not in `PRIOR`** | **new** → open an inline comment (with marker) | — |
| **in `PRIOR`, open** | **leave untouched** — no new comment; keep it in the summary | **reply then resolve** |
| **in `PRIOR`, resolved** | regressed → reply "Reopened: …" (note it; leave resolved unless obvious) | skip |

- **Fixed → resolve with a 👍.** For each prior open thread whose key is gone from
  `CURRENT`, reply then resolve:
  ```bash
  gh api "repos/$O/$R/pulls/<pr>/comments/<commentId>/replies" \
    -f body="Resolved 👍 — fixed in the latest push."
  gh api graphql -f query='mutation($id:ID!){resolveReviewThread(input:{threadId:$id}){thread{isResolved}}}' \
    -F id=<thread>
  ```
- **New findings → one batched review** (skip if none). Omit the body so no
  duplicate summary lands in the timeline; the summary issue comment owns that.
  Each comment body ends with its `<!-- pr-review:finding:<key> -->`:
  ```json
  { "event": "COMMENT", "comments": [
    { "path": "src/foo.tsx", "line": 42, "side": "RIGHT",
      "body": "[coding §3.1 Keep render pure](https://github.com/OWNER/REPO/blob/main/contributing/coding-best-practices.md#L68): `Date.now()` in render → adopt mismatch. Pass a fixed tweak. <!-- pr-review:finding:coding-3.1@src/foo.tsx#render-date-now -->" }
  ]}
  ```
  `gh api "repos/$O/$R/pulls/<pr>/reviews" --input new.json`. Line rules: `path` +
  `line` on the new version (`side:"RIGHT"`; `side:"LEFT"` + old line for a
  deletion, `start_line`+`line` for a range). The line **must** fall in a diff
  hunk or it 422s — if not, demote that finding to the summary.
- **Never re-comment a still-open prior finding** — that's the duplicate the
  marker exists to prevent. It stays in the summary, not as a fresh thread.

**c. Write the summary** (create on first run, else `PATCH` in place):
```bash
# body ends with <!-- pr-review:summary -->
[ -n "$SUMMARY_ID" ] \
  && gh api -X PATCH "repos/$O/$R/issues/comments/$SUMMARY_ID" --input summary.json \
  ||  gh api "repos/$O/$R/issues/<pr>/comments" --input summary.json
```
The summary always reflects the **current** state: one-line verdict
(`Approve` / `Approve with nits` / `Request changes` / `Blocked`), a compact
per-consideration `pass`/`fail`/`n/a` table (`n/a` justified), then one terse
bullet per **open** finding — both still-open-prior and new, so the whole picture
reads in one place — and a short "Resolved this run" line for what you just
closed. Never `APPROVE`/`REQUEST_CHANGES` the PR's review state unprompted; the
verdict lives in the text. Map a real review event to the verdict only if asked.

Then report one line back here: counts (new / still-open / resolved) and the
summary-comment URL. Don't re-paste the body.

## Notes

- **Guilty until proven innocent.** The whole point is to resist the PR's framing.
  "Adds X" in the body means nothing until you see X built, tested, dogfooded,
  spec'd (if behavioral), and documented. Enumerate gaps; don't assume good faith
  closes them.
- **Cite rules, not vibes.** Sweep *every* numbered rule in the three
  best-practices files (§9), not a favourite few. A rule violation leads with the
  rule — number, name, and a link to its line on `main` — before the what's-wrong
  and fix, so the author can act and argue precisely.
- **OpenSpec is the load-bearing axis** of considerations 1–3: behavioral change
  → proposal; proposal internally complete (design ⊇ proposal, tasks ⊇ design,
  specs ⊇ behavior); code matches design. Walk that chain in order. Archival
  (consideration 4) is **not** reviewed — the `openspec` CI guard blocks an
  unarchived proposal from merging, so just read its check status.
- **Scope `n/a` honestly.** A pure-engine PR legitimately skips e2e and dogfood
  cases; a docs-only PR skips changesets-with-bump and specs. State *why* it's
  out of scope so a reader can't mistake an omission for an oversight.
- **Output is the PR review, terse.** Resolvable inline comments first, a brief
  summary at top. Inline comments target **≤2 lines** — what's wrong + a simple
  fix — more only for a genuinely complex problem. Every extra word is a word the
  author skims past.
- **Re-runs reconcile, never duplicate.** Hidden markers
  (`pr-review:summary`, `pr-review:finding:<key>`) let a second run update the
  one summary in place, resolve fixed threads with a 👍 reply, open threads only
  for genuinely new findings, and leave still-open prior threads alone (carried
  in the summary, not re-commented). Keep finding keys stable across runs — anchor
  on rule + path + symbol, not prose or line number.
- This skill **reviews**; it doesn't fix. Hand the changeset to
  `display-case-changeset`, accessibility/visual/token triage to
  `display-case-review`, and an isolated component look to `display-case-snapshot`.
