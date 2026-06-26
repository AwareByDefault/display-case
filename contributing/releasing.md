# Releasing Display Case

Display Case publishes to the public **npm registry** (Bun has no registry of its
own — `bun install` and `bun publish` both speak to npm). Releases are automated
with [Changesets](https://github.com/changesets/changesets): **no manual version
bumps and no manual `npm publish`**. `main` is the release branch.

The version is **decoupled from commit messages** — it comes from the changeset
file(s) a PR includes. Commit/merge style therefore has no effect on the release
(`main` is squash-only).

## The model: a changeset per PR, publish on merge

1. **In your PR**, add a changeset declaring the release impact:

   ```bash
   bun run changeset      # interactive: pick patch / minor / major + write a description
   ```

   This writes a file like `.changeset/cool-otters-sing.md`:

   ```md
   ---
   "@awarebydefault/display-case": minor
   ---

   Add a `--static` flag to `display-case publish` for a server-less export.
   ```

   | Level | When | Example |
   | --- | --- | --- |
   | `patch` | bug fix / internal change, no API change | `0.1.0` → `0.1.1` |
   | `minor` | backward-compatible new capability | `0.1.0` → `0.2.0` |
   | `major` | breaking change to the public API or CLI | `0.1.0` → `1.0.0` |

   For a change that should **not** release (docs, CI, tests, refactors), add an
   empty changeset instead — it satisfies the PR check without bumping anything:

   ```bash
   bun run changeset --empty
   ```

   (The [`display-case-changeset`](../.claude/skills/display-case-changeset) skill
   can write the right changeset from your branch's diff.)

2. **A PR check enforces it.** The `Changeset present` CI job fails any PR that
   adds no `.changeset/*.md`, so release impact is always declared (use an empty
   changeset to opt out of a release).

3. **On merge to `main`**, [`.github/workflows/release.yml`](../.github/workflows/release.yml)
   runs the browser-free gate (`lint` + `typecheck` + `check` + `test`), then —
   only if the merged changes carried any changesets — runs `changeset version`
   (bumps `package.json`, prepends `CHANGELOG.md`, deletes the consumed
   changesets), commits that back to `main` as `chore(release): version packages
   [skip ci]`, `changeset publish`es to npm, and cuts a **GitHub Release** for the
   new `v<version>` tag (notes = that version's `CHANGELOG.md` section). A push
   carrying no changesets is a clean no-op. Multiple changesets in one release
   collapse to the highest level, and each description becomes its own changelog
   line.

The version commit is tagged `[skip ci]` so it doesn't retrigger the workflow.
`changeset publish` creates the `v<version>` git tag; the GitHub Release is cut
separately (`gh release create`) because `changeset publish` never makes one. The
Release step is idempotent — a re-run skips a Release that already exists.

## Branch protection: the release pushes as a GitHub App

The version commit + git tags push **directly to `main`**, which the `Protect
main` ruleset gates behind a PR. The release job therefore pushes as the
**`awarebydefault-release` GitHub App** — the ruleset's sole bypass actor — via a
short-lived token minted with `actions/create-github-app-token`. The built-in
`GITHUB_TOKEN` can't be a ruleset bypass actor, which is why the App exists.

Setup (one-time, already done): the App has **Contents: Read & write**, is
installed on this repo only, and its `RELEASE_APP_ID` + `RELEASE_APP_PRIVATE_KEY`
are repo secrets. The `update-baselines` workflow uses the same App for the same
reason.

## What ships, and why it's raw TypeScript

Display Case is **Bun-native at runtime**, not just at install time — the CLI,
the dev/prod server, and the checks call `Bun.serve` / `Bun.build` / `Bun.file`
directly. Transpiling to JS would not make it Node-runnable (those globals are
still required), so we ship the `src/**/*.ts` sources verbatim and Bun runs them.
The package declares `"engines": { "bun": ">=1.2.0" }`, and the CLI exits early
with a friendly message if launched under Node (`src/cli.ts`). The `files`
allowlist in `package.json` controls the published tarball; verify it with
`npm pack --dry-run` (or `bun pm pack --dry-run`).

## Publishing auth: OIDC trusted publishing (token-bootstrapped)

The package publishes with **[npm trusted publishing](https://docs.npmjs.com/trusted-publishers)** —
GitHub Actions authenticates to npm over OIDC, so no long-lived publish token
lives in the repo. The release job runs on **Node 24 with npm ≥ 11.5.1** (both
required for trusted publishing); `changeset publish` shells out to that `npm`
for the registry handshake.

npm can only configure a trusted publisher on a package that **already exists**,
so the rollout is two phases.

### Phase 1 — bootstrap the first release with a token

1. Mint an npm **Automation** token (Automation/Granular tokens bypass any
   2FA-on-publish requirement) scoped to `@awarebydefault` with publish rights.
2. Add it as the **`NPM_TOKEN`** repo secret. When set, the release job writes a
   one-line `~/.npmrc` from it; when unset, the publish uses OIDC.
3. Land a release-worthy change on `main`; the publish falls back to `NPM_TOKEN`
   and creates `@awarebydefault/display-case`.

### Phase 2 — switch to OIDC and delete the token

4. On **npmjs.com → the package → Settings → Trusted Publisher**, add a GitHub
   Actions publisher:
   - **Organization or user:** `AwareByDefault`
   - **Repository:** `display-case`
   - **Workflow filename:** `release.yml` (filename only, not the path)
   - **Allowed actions:** `npm publish`
5. **Delete the `NPM_TOKEN` secret.** With it gone the job writes no `.npmrc` and
   `npm publish` uses OIDC tokenlessly. Confirm the run log shows the OIDC
   exchange succeeded.

### Future: dropping npm and going bun-only

The Node/npm step in `release.yml` is the only non-Bun part of the pipeline — it
exists solely to provide the `npm` CLI `changeset publish` calls. Two upstream
Bun changes must both land before the job could be fully bun-native:

- **Provenance:** [oven-sh/bun#30522](https://github.com/oven-sh/bun/pull/30522)
  adds `bun publish --provenance`. *Open.*
- **Tokenless OIDC auth:** [oven-sh/bun#24855](https://github.com/oven-sh/bun/issues/24855)
  adds trusted publishing. *Open.*

#30522 alone closes only the provenance gap, not authentication.

### Other requirements

- **Scoped, public package** — `@awarebydefault/display-case`. Scoped packages
  default to *private*, so `publishConfig.access = public` (set in
  `package.json`) is required. The CLI **command** is still `display-case`.
- **Provenance** — `publishConfig.provenance = true` plus the workflow's
  `id-token: write` permission emit provenance attestations on publish.

## Inspecting and recovering

```bash
bun run changeset:status   # what would the pending changesets release?
```

If a release run fails **after** `changeset publish` succeeds but **before** the
push lands, npm has the new version while `main` lacks the bump. Re-run the
workflow (`workflow_dispatch`): `changeset publish` skips versions already on the
registry, the changesets are still on `main`, so the version + push are recreated
idempotently.
