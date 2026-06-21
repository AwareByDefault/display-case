import { resolve } from 'node:path'
import { Glob } from 'bun'
import { resolveConfig } from '../core/discovery'
import { blankComments } from './check-text'

/**
 * Static design-token conformance check for a Display-Case-ingested package.
 *
 * Display Case already knows the two halves of a package's token contract:
 *   - DEFINITIONS — the `globalStyles` CSS it injects into every preview
 *     (`--name: …` declarations), plus any custom properties a component sets at
 *     runtime via an inline `style={{ '--name': … }}` object.
 *   - REFERENCES — every `var(--name…)` in the package's own source (component
 *     CSS/TSX and the `.case.tsx` files).
 *
 * This pass flags any `var(--name)` whose name is neither defined in the package
 * nor explicitly allow-listed. It catches the class of bug where a component
 * borrows a foreign design system's token name (e.g. a shadcn-style
 * `var(--muted-foreground, #6b7280)`) that never resolves and silently falls
 * back to a hardcoded value — well-formed CSS, but a vocabulary violation that
 * breaks theming and contrast.
 *
 * Intentionally opinionated: a `var(--x, fallback)` reference is still flagged
 * even though the fallback makes it valid CSS. The whole point is to require
 * every reference to resolve within *this* package's declared vocabulary.
 *
 * Static and browser-free — pure parse, so it is cheap enough to gate on commit.
 */

export interface TokenViolation {
  /** Absolute path to the file containing the reference. */
  file: string
  /** 1-based line number. */
  line: number
  /** 1-based column of the `--token`. */
  column: number
  /** The unresolved custom-property name, e.g. `--muted-foreground`. */
  token: string
  /** True when the reference carried a fallback (`var(--x, …)`). */
  hadFallback: boolean
}

export interface TokenCheckResult {
  pkgDir: string
  scannedFiles: number
  definedCount: number
  violations: TokenViolation[]
}

// `var(` then a custom property, capturing a following comma (⇒ has fallback).
const REF_RE = /var\(\s*(--[A-Za-z0-9_-]+)\s*(,)?/g
// A CSS custom-property *declaration*: `--name:` at a value-position boundary.
// The boundary excludes `var(--name)` (preceded by `(`) and JS object keys
// (preceded by a quote), so only genuine definitions are harvested.
const CSS_DEF_RE = /(?:^|[\s;{,])(--[A-Za-z0-9_-]+)\s*:/g
// An inline-style definition in JS/TSX: a quoted object key, e.g.
// `style={{ '--ring': color }}`. These set the property at runtime.
const JS_DEF_RE = /['"`](--[A-Za-z0-9_-]+)['"`]\s*:/g
// Per-reference escape hatch (mirrors the repo's `allow: <reason>` convention).
const ESCAPE_RE = /allow:\s*unknown-token/

interface ScannedFile {
  path: string
  /** Comment-blanked text (offsets + line breaks preserved). */
  clean: string
  /** Original, unmodified lines — used only for the escape-comment lookup. */
  rawLines: string[]
  isCss: boolean
}

function collectDefs(file: ScannedFile, into: Set<string>): void {
  const re = file.isCss ? CSS_DEF_RE : JS_DEF_RE
  re.lastIndex = 0
  for (let m = re.exec(file.clean); m; m = re.exec(file.clean)) {
    into.add(m[1])
  }
}

function collectRefs(
  file: ScannedFile,
  defined: Set<string>,
  out: TokenViolation[],
): void {
  const cleanLines = file.clean.split('\n')
  cleanLines.forEach((line, idx) => {
    REF_RE.lastIndex = 0
    for (let m = REF_RE.exec(line); m; m = REF_RE.exec(line)) {
      const token = m[1]
      if (defined.has(token)) continue
      // Escape may sit on the reference line or the line directly above it.
      const raw = file.rawLines[idx] ?? ''
      const above = idx > 0 ? (file.rawLines[idx - 1] ?? '') : ''
      if (ESCAPE_RE.test(raw) || ESCAPE_RE.test(above)) continue
      out.push({
        file: file.path,
        line: idx + 1,
        column: m.index + m[0].indexOf(token) + 1,
        token,
        hadFallback: m[2] === ',',
      })
    }
  })
}

/**
 * Run the token-reference conformance pass over one ingested package.
 * Resolves the package's Display Case config to learn `globalStyles` (token
 * definitions) and scans the whole package source tree for definitions +
 * references.
 */
export async function checkTokens(pkgDir: string): Promise<TokenCheckResult> {
  const { config } = await resolveConfig(pkgDir)

  // Gather the files that hold definitions and/or references: the configured
  // global stylesheets (token source of truth) plus all package source.
  const paths = new Set<string>()
  for (const rel of config.globalStyles ?? []) paths.add(resolve(pkgDir, rel))
  const glob = new Glob('**/*.{css,ts,tsx}')
  for await (const match of glob.scan({ cwd: pkgDir, absolute: true })) {
    if (
      match.includes('/node_modules/') ||
      match.includes('/.display-case/') ||
      match.includes('/dist/')
    ) {
      continue
    }
    paths.add(match)
  }

  const files: ScannedFile[] = []
  for (const path of paths) {
    if (!(await Bun.file(path).exists())) continue
    const text = await Bun.file(path).text()
    const isCss = path.endsWith('.css')
    files.push({
      path,
      clean: blankComments(text, isCss),
      rawLines: text.split('\n'),
      isCss,
    })
  }

  // Pass 1 — every defined token across the whole package (definitions may live
  // in a different file than the reference), seeded with the config allowlist.
  const defined = new Set<string>(config.tokens?.allow ?? [])
  for (const file of files) collectDefs(file, defined)

  // Pass 2 — flag references to names the package never defines.
  const violations: TokenViolation[] = []
  for (const file of files) collectRefs(file, defined, violations)
  violations.sort(
    (a, b) =>
      a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column,
  )

  return {
    pkgDir,
    scannedFiles: files.length,
    definedCount: defined.size,
    violations,
  }
}
