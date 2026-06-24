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
 *
 * The pure scanning/fixing logic is exported for tests
 * (`spec-purity.test.ts`); the file walk + process exit run only when this
 * module is the entrypoint.
 */
import { resolve } from 'node:path'
import { Glob } from 'bun'

// Implementation/tool names that betray the stack — a behavior spec names none.
export const FORBIDDEN = [
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

export type SpecViolation = {
  /** 1-based line number. */
  line: number
  kind: 'forbidden-term' | 'bold-keyword'
  message: string
  /** the offending source line, trimmed */
  text: string
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Scan one spec's text for purity violations. Fenced code blocks and lines
 * carrying an `<!-- allow: -->` escape are exempt.
 */
export function scanSpecText(text: string): SpecViolation[] {
  const out: SpecViolation[] = []
  let inFence = false

  text.split('\n').forEach((line, idx) => {
    if (/^\s*```/.test(line)) {
      inFence = !inFence
      return
    }
    if (inFence || ALLOW_RE.test(line)) return

    for (const term of FORBIDDEN) {
      const re = new RegExp(`(?<![\\w-])${escapeRe(term)}(?![\\w-])`)
      if (re.test(line)) {
        out.push({
          line: idx + 1,
          kind: 'forbidden-term',
          message: `implementation detail "${term}" in a spec`,
          text: line.trim(),
        })
      }
    }

    const bold = line.match(BOLD_KEYWORD_RE)
    if (bold) {
      out.push({
        line: idx + 1,
        kind: 'bold-keyword',
        message: `bolded scenario keyword — use bullet form (\`- ${bold[2]} …\`)`,
        text: line.trim(),
      })
    }
  })

  return out
}

/**
 * Rewrite bolded scenario keywords to bullet form (`**GIVEN** x` → `- GIVEN x`),
 * preserving indentation. Forbidden terms cannot be auto-fixed, so they are left
 * untouched (and still reported by `scanSpecText`).
 */
export function fixSpecText(text: string): string {
  let inFence = false
  return text
    .split('\n')
    .map((line) => {
      if (/^\s*```/.test(line)) {
        inFence = !inFence
        return line
      }
      if (inFence || ALLOW_RE.test(line)) return line
      return line.replace(BOLD_KEYWORD_RE, (_m, ws, kw) => `${ws}- ${kw}`)
    })
    .join('\n')
}

async function main(): Promise<void> {
  const fixMode = process.argv.includes('--fix')
  const root = resolve(import.meta.dir, '../..')
  const glob = new Glob('openspec/specs/**/spec.md')

  let violations = 0
  for await (const path of glob.scan({ cwd: root, absolute: true })) {
    const original = await Bun.file(path).text()
    const rel = path.replace(`${root}/`, '')
    const text = fixMode ? fixSpecText(original) : original
    if (fixMode && text !== original) await Bun.write(path, text)

    for (const v of scanSpecText(text)) {
      // In --fix mode the bold-keyword findings are already rewritten above;
      // only the non-fixable forbidden terms remain to report (non-fatal).
      if (fixMode && v.kind === 'bold-keyword') continue
      violations += 1
      console.error(`${rel}:${v.line}: ${v.message}`)
      console.error(`  > ${v.text}`)
    }
  }

  if (!fixMode && violations > 0) {
    console.error(`\nspec-purity check failed: ${violations} violation(s)`)
    process.exit(1)
  }
  console.log('spec-purity check passed')
}

if (import.meta.main) await main()
