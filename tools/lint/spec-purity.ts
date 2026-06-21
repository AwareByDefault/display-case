#!/usr/bin/env bun
/**
 * Keeps the OpenSpec behavior specs implementation-free.
 *
 * An `openspec/specs/{capability}/spec.md` describes observable
 * behavior only — it should survive a stack migration unchanged. This check
 * fails when a spec:
 *   - names an implementation/tool detail (the stack, libraries, runtimes), or
 *   - uses bolded scenario keywords (`**GIVEN**`) instead of bullet form.
 *
 * Structural validity (required sections, ≥1 scenario per requirement) is an
 * OpenSpec-CLI concern (`openspec validate`) and intentionally not duplicated
 * here; this check owns the project-specific conventions the CLI doesn't know.
 *
 * Per-line escape: `<!-- allow: <reason> -->` on the same line.
 * Pass `--fix` to auto-convert bolded scenario keywords to bullet form.
 */
import { resolve } from 'node:path'
import { Glob } from 'bun'

const FIX_MODE = process.argv.includes('--fix')

// Implementation/tool names that betray the stack — a behavior spec names none.
const FORBIDDEN = [
  'Bun',
  'bunx',
  'React',
  'Vite',
  'Webpack',
  'Storybook',
  'Playwright',
  'axe-core',
  'pixelmatch',
  'pngjs',
  'MDX',
  'TypeScript',
  'JavaScript',
  'Node.js',
  'Docker',
  'npm',
  'yarn',
]

const ALLOW_RE = /<!--\s*allow:.*-->/
const KEYWORDS = ['GIVEN', 'WHEN', 'THEN', 'AND']
// A bolded scenario keyword at the start of a line: `  **GIVEN** ...`
// Capture (leading whitespace)(keyword) so the fix can rewrite to bullet form.
const BOLD_KEYWORD_RE = new RegExp(`^(\\s*)\\*\\*(${KEYWORDS.join('|')})\\*\\*`)

const root = resolve(import.meta.dir, '../..')
const glob = new Glob('openspec/specs/**/spec.md')

let violations = 0

for await (const path of glob.scan({ cwd: root, absolute: true })) {
  const original = await Bun.file(path).text()
  const lines = original.split('\n')
  const rel = path.replace(`${root}/`, '')
  let inFence = false

  const fixed = lines.map((line, idx) => {
    if (/^\s*```/.test(line)) inFence = !inFence
    if (inFence || ALLOW_RE.test(line)) return line

    for (const term of FORBIDDEN) {
      const re = new RegExp(`(?<![\\w-])${escapeRe(term)}(?![\\w-])`)
      if (re.test(line)) {
        violations += 1
        console.error(
          `${rel}:${idx + 1}: implementation detail "${term}" in a spec`,
        )
        console.error(`  > ${line.trim()}`)
      }
    }

    const bold = line.match(BOLD_KEYWORD_RE)
    if (bold) {
      if (FIX_MODE) {
        // `  **GIVEN** x` → `  - GIVEN x` (indentation preserved).
        return line.replace(BOLD_KEYWORD_RE, (_m, ws, kw) => `${ws}- ${kw}`)
      }
      violations += 1
      console.error(
        `${rel}:${idx + 1}: bolded scenario keyword — use bullet form (\`- ${bold[2]} …\`)`,
      )
      console.error(`  > ${line.trim()}`)
    }
    return line
  })

  if (FIX_MODE) {
    const next = fixed.join('\n')
    if (next !== original) await Bun.write(path, next)
  }
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

if (!FIX_MODE && violations > 0) {
  console.error(`\nspec-purity check failed: ${violations} violation(s)`)
  process.exit(1)
}
console.log('spec-purity check passed')
