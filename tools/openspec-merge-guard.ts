#!/usr/bin/env bun
/**
 * openspec-merge-guard — CI gate keeping unarchived OpenSpec proposals off main.
 *
 * An OpenSpec proposal may stay open while its PR is under review, but it must
 * not *land* on main unarchived. The only OpenSpec content a PR may merge is:
 *
 *   - additional archived proposals  (openspec/changes/archive/**)
 *   - spec changes                   (openspec/specs/**)
 *
 * So this guard fails the PR when its diff **adds or modifies** any file under
 * `openspec/changes/` that is not under `openspec/changes/archive/` — i.e. an
 * active, unarchived proposal. Deletions there are fine: removing the active copy
 * is exactly what archiving a change looks like (the archived copy lands under
 * `openspec/changes/archive/`, which is allowed). `openspec/config.yaml` and
 * anything outside `openspec/changes/` are untouched by this check.
 *
 * Base ref: `$BASE_SHA` (the PR base in CI), else argv[2], else `origin/main`.
 * Compares with the three-dot range so it reads the branch's own additions.
 *
 * The pure classifier `findOffenders` is exported for tests
 * (`openspec-merge-guard.test.ts`); the git call + process exit run only when
 * this module is the entrypoint.
 */
import { execFileSync } from 'node:child_process'

const ACTIVE = 'openspec/changes/'
const ARCHIVE = 'openspec/changes/archive/'

/**
 * Given `git diff --name-status --no-renames` output (paths under `openspec/`),
 * return the active (unarchived) proposal paths a PR may not land: files **added
 * or modified** under `openspec/changes/` but not under
 * `openspec/changes/archive/`. Deletions (status `D…`) are allowed — that is how
 * a change leaves the active tree on archival.
 */
export function findOffenders(nameStatus: string): string[] {
  const offenders: string[] = []
  for (const line of nameStatus.split('\n')) {
    if (!line.trim()) continue
    const [status, ...rest] = line.split('\t')
    const path = rest.join('\t')
    if (!status || status.startsWith('D')) continue
    if (path.startsWith(ACTIVE) && !path.startsWith(ARCHIVE))
      offenders.push(path)
  }
  return offenders
}

function main(): void {
  const base = process.env.BASE_SHA || process.argv[2] || 'origin/main'

  let nameStatus: string
  try {
    nameStatus = execFileSync(
      'git',
      [
        'diff',
        '--name-status',
        '--no-renames',
        `${base}...HEAD`,
        '--',
        'openspec/',
      ],
      { encoding: 'utf8' },
    )
  } catch (err) {
    console.error(
      `openspec-merge-guard: \`git diff\` against "${base}" failed — is the base ref fetched? (CI needs fetch-depth: 0)\n${
        err instanceof Error ? err.message : String(err)
      }`,
    )
    process.exit(2)
  }

  const offenders = findOffenders(nameStatus)
  if (offenders.length > 0) {
    const list = offenders.map((p) => `  ${p}`).join('\n')
    console.error(
      `::error::Unarchived OpenSpec proposal cannot merge to main. Archive the change before merging — ` +
        `move openspec/changes/<name>/ → openspec/changes/archive/YYYY-MM-DD-<name>/ and fold its spec ` +
        `deltas into openspec/specs/ (\`bun run openspec archive <name>\`). Offending paths:\n${list}`,
    )
    process.exit(1)
  }

  console.log(
    'openspec-merge-guard: OK — no unarchived proposal in this PR diff.',
  )
}

if (import.meta.main) main()
