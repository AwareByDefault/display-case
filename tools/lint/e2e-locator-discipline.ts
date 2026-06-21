#!/usr/bin/env bun
/**
 * Enforces e2e locator discipline in the Playwright suite under `e2e/`.
 *
 * Specs must drive the browse chrome only through `data-testid`s exported from
 * `src/ui/test-ids.ts` (`DcTestIds`) — never text/role/CSS selectors, and never
 * a hardcoded testid string. See contributing/testing-best-practices.md §6.
 *
 * Forbidden patterns:
 *   - .getByText(          — use getByTestId(DcTestIds.xxx)
 *   - .getByRole(          — use getByTestId(DcTestIds.xxx)
 *   - :has-text(           — CSS pseudo-class text matcher in selector strings
 *   - text=                — Playwright text= selector prefix
 *   - getByTestId('...')   — hardcoded string literal (must use a DcTestIds member)
 *
 * Per-line escape: // allow: locator-discipline
 */
import { resolve } from 'node:path'
import { Glob } from 'bun'

const root = resolve(import.meta.dir, '../..')
const glob = new Glob('e2e/**/*.ts')

const ALLOW_RE = /\/\/\s*allow:\s*locator-discipline/

const FORBIDDEN: Array<{ re: RegExp; msg: string }> = [
  {
    re: /\.getByText\s*\(/,
    msg: 'use getByTestId(DcTestIds.xxx) instead of getByText()',
  },
  {
    re: /\.getByRole\s*\(/,
    msg: 'use getByTestId(DcTestIds.xxx) instead of getByRole()',
  },
  {
    re: /:has-text\s*\(/,
    msg: 'use getByTestId(DcTestIds.xxx) instead of :has-text() CSS selector',
  },
  {
    re: /['"` ]text=(?!id)/,
    msg: 'use getByTestId(DcTestIds.xxx) instead of a text= locator',
  },
]

// getByTestId('string-literal') / getByTestId("string-literal") — not a variable.
const HARDCODED_TESTID_RE = /getByTestId\s*\(\s*(['"])[^'"]+\1\s*\)/

let violations = 0

for await (const path of glob.scan({ cwd: root, absolute: true })) {
  const text = await Bun.file(path).text()
  const lines = text.split('\n')
  const rel = path.replace(`${root}/`, '')

  lines.forEach((line, idx) => {
    if (ALLOW_RE.test(line)) return

    for (const { re, msg } of FORBIDDEN) {
      if (re.test(line)) {
        violations += 1
        console.error(`${rel}:${idx + 1}: ${msg}`)
        console.error(`  > ${line.trim()}`)
      }
    }

    if (HARDCODED_TESTID_RE.test(line)) {
      violations += 1
      console.error(
        `${rel}:${idx + 1}: hardcoded string in getByTestId() — use a DcTestIds member`,
      )
      console.error(`  > ${line.trim()}`)
    }
  })
}

if (violations > 0) {
  console.error(
    `\ne2e-locator-discipline check failed: ${violations} violation(s)`,
  )
  process.exit(1)
}
console.log('e2e-locator-discipline check passed')
