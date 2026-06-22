# Releasing Display Case

Display Case publishes to the public **npm registry** (Bun has no registry of its
own — `bun install` and `bun publish` both speak to npm). Releases are fully
automated by [semantic-release](https://semantic-release.gitbook.io/): there are
**no manual version bumps and no manual `npm publish`**. `main` is the release
branch.

## How a release happens

1. You merge a PR (or push) to `main`.
2. `.github/workflows/release.yml` runs the browser-free gate
   (`lint` + `typecheck` + `check` + `test`), then `bunx semantic-release`.
3. semantic-release reads every Conventional-Commit message since the last git
   tag and decides the next version:

   | Commit type | Release |
   | --- | --- |
   | `fix:` | patch (`0.1.0` → `0.1.1`) |
   | `feat:` | minor (`0.1.0` → `0.2.0`) |
   | `feat!:` / `fix!:` / a `BREAKING CHANGE:` footer | major (`0.1.0` → `1.0.0`) |
   | `chore:` `docs:` `refactor:` `test:` `ci:` `build:` `style:` `perf:` (alone) | **no release** |

4. If (and only if) there is a release-worthy commit, it bumps `package.json`,
   writes `CHANGELOG.md`, `npm publish`es the package (raw TS — see below), pushes
   a `vX.Y.Z` git tag + the release commit, and opens a GitHub Release. A push
   with only `chore`/`docs` commits is a clean no-op.

The release commit is tagged `[skip ci]` so it doesn't retrigger the workflow.

## What ships, and why it's raw TypeScript

Display Case is **Bun-native at runtime**, not just at install time — the CLI,
the dev/prod server, and the checks call `Bun.serve` / `Bun.build` / `Bun.file`
directly. Transpiling to JS would not make it Node-runnable (those globals are
still required), so we ship the `src/**/*.ts` sources verbatim and Bun runs them.
The package therefore declares `"engines": { "bun": ">=1.2.0" }`, and the CLI
exits early with a friendly message if launched under Node (`src/cli.ts`). The
`files` allowlist in `package.json` controls the published tarball; verify it
with `npm pack --dry-run` (or `bun pm pack --dry-run`).

## Conventional Commits are mandatory

Because the version is derived from commit messages, every commit must follow
[Conventional Commits](https://www.conventionalcommits.org/). This is enforced
locally by the `commit-msg` husky hook (`commitlint.config.js`) and is the input
semantic-release relies on. Examples:

```
feat: add --static flag to publish
fix(server): release the port on SIGTERM
feat!: rename defineCases options.level → tier   # BREAKING — major bump
docs: clarify the tweak vocabulary               # no release
```

## Publishing auth: OIDC trusted publishing (token-bootstrapped)

The package publishes with **[npm trusted publishing](https://docs.npmjs.com/trusted-publishers)** —
GitHub Actions authenticates to npm over OIDC, so no long-lived publish token
lives in the repo. `@semantic-release/npm` (≥ 13.1, shipped with semantic-release
≥ 25) attempts an OIDC token exchange first and **falls back to `NPM_TOKEN`** only
if that fails. The workflow runs on **Node 24 with npm ≥ 11.5.1** (both required
for trusted publishing) and runs `semantic-release` under Node, not bunx.

There's a chicken-and-egg: npm can only configure a trusted publisher on a
package that **already exists**, so the rollout is two phases.

### Phase 1 — bootstrap the first release with a token

1. Mint an npm **Automation** token (Automation/Granular tokens bypass any
   2FA-on-publish requirement; a classic token that needs an OTP will fail in CI)
   scoped to the `@awarebydefault` org with publish rights.
2. Add it as the **`NPM_TOKEN`** repo secret under *Settings → Secrets and
   variables → Actions*. (`GITHUB_TOKEN` is automatic.)
3. Land a release-worthy commit on `main`. The OIDC exchange returns "package not
   found", so the publish falls back to `NPM_TOKEN` and creates
   `@awarebydefault/display-case`.

### Phase 2 — switch to OIDC and delete the token

4. On **npmjs.com → the package → Settings → Trusted Publisher**, add a GitHub
   Actions publisher:
   - **Organization or user:** `AwareByDefault`
   - **Repository:** `display-case`
   - **Workflow filename:** `release.yml` (filename only, not the path)
   - **Allowed actions:** `npm publish`
5. The next release exchanges the OIDC token successfully and publishes
   tokenlessly. Confirm the run log shows *"OIDC token exchange with the npm
   registry succeeded"*.
6. **Delete the `NPM_TOKEN` secret** (and the `NPM_TOKEN:` env line in
   `release.yml`). From here, releases need no npm secret at all.

### Future: dropping npm and going bun-only

The Node/npm step in `release.yml` is the only non-Bun part of the pipeline — it
exists solely to provide the `npm` CLI for the registry handshake (`bun publish`
can't yet do OIDC trusted publishing, and semantic-release shells out to `npm`).
Two upstream Bun changes must both land before the job could be fully bun-native:

- **Provenance:** [oven-sh/bun#30522](https://github.com/oven-sh/bun/pull/30522)
  adds `bun publish --provenance` (Sigstore keyless signing). *Open.*
- **Tokenless OIDC auth:** [oven-sh/bun#24855](https://github.com/oven-sh/bun/issues/24855)
  adds trusted publishing. *Open.*

#30522 alone closes only the provenance gap, not authentication — don't switch on
its merge. Revisit when both ship (and semantic-release can drive `bun publish`,
or we hand-roll the publish step).

### Other requirements

- **Scoped, public package** — the package is `@awarebydefault/display-case`
  (the bare `display-case` name is taken). Scoped packages default to *private*,
  so `publishConfig.access = public` (already set) is required for the publish to
  succeed. The CLI **command** is still `display-case` (the `bin` name is
  independent of the package scope); a cold one-off uses the full name —
  `bunx @awarebydefault/display-case`.
- **Provenance** — generated automatically. With trusted publishing, npm emits
  provenance attestations without the `--provenance` flag; `publishConfig.provenance`
  also covers the Phase-1 token publish. Both rely on the workflow's
  `id-token: write` permission.
- **Branch protection** — if `main` requires PRs, allow semantic-release's
  release commit through (it pushes directly). The `[skip ci]` tag prevents a
  loop, but a hard "require PR for all pushes" rule will block the bot; grant it
  an exception or use a PAT/GitHub App token in place of `GITHUB_TOKEN`.

## Dry run

Preview what the next release would be without publishing:

```bash
bun run release:dry   # semantic-release --dry-run --no-ci
```
