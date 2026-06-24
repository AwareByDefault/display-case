# pr-review

Adversarially review a GitHub PR against Display Case's engineering bar.

## What it does

Takes a PR (URL or number), pulls the diff and CI status, and reviews it for code
quality **and** completeness — assuming the change is incomplete until the diff
proves otherwise. Beyond ordinary code review it checks the things Display Case
cares about specifically:

1. Does the change deserve an **OpenSpec proposal** — and does it include one?
2. If proposed: do **design ⊇ proposal**, **tasks ⊇ design**, **specs ⊇ behavior**?
3. Does the **code match** the design/tasks?
4. *(Archival is **not** reviewed — the `openspec` CI merge guard blocks an
   unarchived proposal from merging; the skill just reads that check's status.)*
5. Are the changes reflected in the repo's own **dogfood** showcase?
6. Appropriate **unit-test** coverage (happy *and* error paths, deterministic)?
7. Appropriate **e2e** coverage for chrome changes (`getByTestId`, no sleeps)?
8. Is the code **worth shipping to the world**?
9. Does it respect the **Display Case ethos** (render purity, quiet chrome, no
   dev machinery in builds, no consuming-app code pulled in)?
10. Does it follow coding / testing / linting **best practices**? (A full sweep of
    **every** numbered rule in the three `contributing/*-best-practices.md` files,
    not a spot-check — and the gates pass.)
11. Is the **documentation** fully updated?

## When it triggers

Given a PR URL or number and asked to "review this PR", "do a thorough/adversarial
review", "is this PR ready to merge", or "what's missing in this change".

## How it works

1. `gh pr view` / `gh pr diff` / `gh pr checks` to gather the facts; group the diff
   by area; optionally `gh pr checkout` to run the gates.
2. Walk the OpenSpec chain (proposal → design → tasks → specs → code; archival is
   left to the CI guard), then dogfood, unit tests, e2e, quality/ethos/best-
   practices, and docs — citing the specific numbered rule each finding violates.
3. Post findings to the PR, **summary first**: a terse summary comment — verdict +
   one line per **open** finding, only what still needs fixing (no scan checklist;
   on a re-run, fixed items drop off) — posted ahead of every other comment the
   skill makes, then code-tied findings as resolvable inline line comments (always
   preferred). Inline comments are ≤2 lines. Every best-practice rule reference —
   in the summary and inline alike — **must** be a Markdown link to that rule's
   line on `main` (e.g. `[coding 3.1 Keep render pure](…/contributing/coding-best-practices.md#L68)`),
   leading the comment before the what's-wrong and fix.

**Re-runnable.** Hidden markers make a second run on the same PR idempotent: it
updates the one summary in place, replies "Resolved 👍" and resolves threads whose
findings are now fixed, opens new resolvable comments for new findings, and leaves
still-open prior findings alone (kept in the summary, never re-commented).

Grounded in [`../../../contributing/`](../../../contributing/), the
[`openspec/`](../../../openspec/) workspace, and [`CLAUDE.md`](../../../CLAUDE.md).
It reviews; it doesn't fix — pair with `display-case-changeset`,
`display-case-review`, and `display-case-snapshot`.
