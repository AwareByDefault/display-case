#!/usr/bin/env bun
/**
 * Forbids hand-authored inline `<svg>` markup in the browse chrome.
 *
 * The Vitrine design system (`src/ui/design-system/`) is deliberately
 * icon-font-free and SVG-free: "Unicode glyphs only. No icon font, no SVG, no
 * emoji." An inline `<svg>` in the chrome breaks that identity and the
 * snapshot/SSR determinism the glyph approach guarantees. Scope is `src/ui/**`
 * (the chrome + design system); the rest of `src/` is the tool's machinery.
 *
 * Per-line escape: an `allow: custom-svg` comment on the `<svg` line or the
 * line directly above it.
 */
import { resolve } from 'node:path'
import { Glob } from 'bun'

const root = resolve(import.meta.dir, '../..')
const glob = new Glob('src/ui/**/*.{ts,tsx}')

const ALLOW_RE = /allow:\s*custom-svg/
// `<svg` followed by whitespace, `/`, `>`, or EOL (attributes often wrap).
// Excludes substrings like `<svgPath>`.
const SVG_RE = /<svg(?=[\s/>]|$)/

let violations = 0

for await (const path of glob.scan({ cwd: root, absolute: true })) {
  const lines = (await Bun.file(path).text()).split('\n')
  const rel = path.replace(`${root}/`, '')

  lines.forEach((line, idx) => {
    if (!SVG_RE.test(line)) return
    if (ALLOW_RE.test(line) || (idx > 0 && ALLOW_RE.test(lines[idx - 1])))
      return
    violations += 1
    console.error(
      `${rel}:${idx + 1}: inline <svg> — the chrome uses Unicode glyphs, not SVG`,
    )
    console.error(`  > ${line.trim()}`)
  })
}

if (violations > 0) {
  console.error(`\nno-custom-svg check failed: ${violations} violation(s)`)
  process.exit(1)
}
console.log('no-custom-svg check passed')
