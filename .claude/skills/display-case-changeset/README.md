# display-case-changeset

Write or update a PR's Changeset — the file that declares its release impact.

## What it does

Inspects the branch's diff against its base, decides the bump level
(patch/minor/major, or no-release) against Display Case's public surface, and
writes a `.changeset/*.md` with a CHANGELOG-ready description. Versioning is
decoupled from commit messages, so this file is what drives the next release.

## When it triggers

"Add a changeset", "declare the release", "what version bump is this", or when
the `Changeset present` CI check fails a PR.

## How it works

1. Read the diff (`git diff origin/main...HEAD`), weighing user-facing impact.
2. Pick the level: major (breaks the public API/CLI), minor (new capability),
   patch (fix/internal), or an empty changeset (docs/CI/tests only).
3. Write or update `.changeset/*.md` via `bun run changeset` (or `--empty`).

Details: [`../../../contributing/releasing.md`](../../../contributing/releasing.md).
