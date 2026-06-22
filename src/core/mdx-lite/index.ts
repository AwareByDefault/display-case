/**
 * mdx-lite — a deliberately tiny, dependency-free compiler for a *constrained*
 * dialect of MDX, targeting the one thing Display Case's Primer actually needs:
 * Markdown prose interleaved with **block-level** JSX specimens, plus real ES
 * `import` statements that resolve like any other TypeScript module.
 *
 * It is NOT a general MDX implementation. It does not parse the combined
 * Markdown+JSX grammar that `@mdx-js/mdx` does. Instead it *segments* a document
 * into three block kinds and emits a `.tsx` module, then hands the hard parts
 * back to the toolchain that already exists:
 *
 *   - **imports** → passed through verbatim; the bundler (Bun) resolves them.
 *   - **JSX blocks** → passed through verbatim; the TSX compiler handles JSX and
 *     expression props (e.g. `style={{…}}`) for free — the exact features a
 *     runtime Markdown renderer cannot do.
 *   - **markdown runs** → emitted as `<Markdown>{"…"}</Markdown>` using a single
 *     runtime Markdown component (markdown-to-jsx), the same renderer the doc
 *     placards use.
 *
 * The compiled default export is `MDXContent({ components })`, matching the MDX
 * calling convention Display Case's primer mount already uses: capitalized tags
 * the document does not import (notably `<Display>`) resolve from `components`,
 * and Markdown headings route to `components.h1` / `components.h2`.
 *
 * Self-contained on purpose (no imports from the rest of the repo) so it can be
 * lifted into its own package later if it proves useful in isolation.
 *
 * ## The supported dialect (everything else is out of scope and should be
 * rejected by callers such as the structure check)
 *
 *   - `import`/`export` statements at column 0 (single- or multi-line).
 *   - CommonMark + GFM prose, as supported by markdown-to-jsx. Raw HTML is NOT
 *     rendered (`disableParsingRawHTML`).
 *   - **Block-level** JSX only: an element that begins a line at column 0 with
 *     `<Capitalized…` or a `<>` fragment, consumed to its matching close.
 *   - Fenced code blocks are prose, never JSX — even when they contain `<Tag>`.
 *
 *   Unsupported (by construction): inline JSX inside a prose paragraph, Markdown
 *   syntax inside JSX children (passed through as literal JSX), and `{expression}`
 *   interpolation in prose.
 */

export type MdxBlock =
  | { kind: 'imports'; code: string }
  | { kind: 'markdown'; text: string }
  | { kind: 'jsx'; code: string; tags: string[] }

export interface MdxToTsxOptions {
  /** Import specifier for the runtime Markdown component. Default markdown-to-jsx. */
  markdownSpecifier?: string
}

// ----------------------------------------------------------------------------
// Low-level character scanners. Each takes the full source and a start index,
// and returns the index immediately AFTER the construct it consumed.
// ----------------------------------------------------------------------------

function isWs(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r'
}

function skipWs(s: string, from: number): number {
  let p = from
  while (p < s.length && isWs(s[p] as string)) p++
  return p
}

/** Scan a string literal. `s[from]` is the opening quote (', ", or `). Handles
 *  escapes and — for templates — nested `${ … }` interpolation. */
export function scanString(s: string, from: number): number {
  const quote = s[from]
  let p = from + 1
  while (p < s.length) {
    const c = s[p]
    if (c === '\\') {
      p += 2
      continue
    }
    if (quote === '`' && c === '$' && s[p + 1] === '{') {
      p = scanBraces(s, p + 1)
      continue
    }
    if (c === quote) return p + 1
    p++
  }
  throw new Error('mdx-lite: unterminated string literal')
}

/** Scan a brace group. `s[from]` is `{`. Returns the index after the matching
 *  `}`. Respects nested braces, string/template literals, and `//` + block
 *  comments — so `style={{ a: '}' }}`, `{/* } *​/}` and friends are handled. */
export function scanBraces(s: string, from: number): number {
  let p = from + 1 // past the opening {
  while (p < s.length) {
    const c = s[p] as string
    if (c === '{') {
      p = scanBraces(s, p)
      continue
    }
    if (c === '}') return p + 1
    if (c === '"' || c === "'" || c === '`') {
      p = scanString(s, p)
      continue
    }
    if (c === '/' && s[p + 1] === '/') {
      const nl = s.indexOf('\n', p)
      p = nl === -1 ? s.length : nl
      continue
    }
    if (c === '/' && s[p + 1] === '*') {
      const end = s.indexOf('*/', p + 2)
      p = end === -1 ? s.length : end + 2
      continue
    }
    p++
  }
  throw new Error('mdx-lite: unterminated braces')
}

function readName(s: string, from: number): { name: string; next: number } {
  let p = from
  while (p < s.length && /[\w$.-]/.test(s[p] as string)) p++
  return { name: s.slice(from, p), next: p }
}

/** Scan one JSX element. `s[from]` is `<`. Returns the index after the element's
 *  close. Collects every element/component tag name into `tags`. */
export function scanElement(s: string, from: number, tags: string[]): number {
  let p = skipWs(s, from + 1)
  // Fragment <> … </>
  if (s[p] === '>') return scanChildren(s, p + 1, tags)
  const { name, next } = readName(s, p)
  tags.push(name)
  p = next
  // Attributes
  while (p < s.length) {
    p = skipWs(s, p)
    if (s[p] === '/' && s[p + 1] === '>') return p + 2
    if (s[p] === '>') {
      p++
      break
    }
    if (s[p] === '{') {
      // spread attribute {...x}
      p = scanBraces(s, p)
      continue
    }
    // attribute name
    while (p < s.length && !/[\s=/>]/.test(s[p] as string)) p++
    p = skipWs(s, p)
    if (s[p] === '=') {
      p = skipWs(s, p + 1)
      if (s[p] === '{') p = scanBraces(s, p)
      else if (s[p] === '"' || s[p] === "'") p = scanString(s, p)
      else while (p < s.length && !/[\s>]/.test(s[p] as string)) p++
    }
  }
  return scanChildren(s, p, tags)
}

/** Scan element children starting after the open tag's `>`. Returns the index
 *  after the matching close tag (`</…>` or `</>`). */
function scanChildren(s: string, from: number, tags: string[]): number {
  let p = from
  while (p < s.length) {
    const c = s[p]
    if (c === '<') {
      if (s[p + 1] === '/') {
        // closing tag — consume through '>'
        p += 2
        while (p < s.length && s[p] !== '>') p++
        return p + 1
      }
      p = scanElement(s, p, tags)
      continue
    }
    if (c === '{') {
      p = scanBraces(s, p)
      continue
    }
    p++ // text node
  }
  throw new Error('mdx-lite: unterminated JSX element')
}

// ----------------------------------------------------------------------------
// Segmentation
// ----------------------------------------------------------------------------

const FENCE = /^\s*(```|~~~)/
const IMPORT_EXPORT = /^(import|export)\b/
const JSX_BLOCK_START = /^<([A-Z]|>)/

/** Count `{` minus `}` outside strings/comments — used to tell whether a
 *  (possibly multi-line) import/export statement is complete. */
function braceBalance(text: string): number {
  let depth = 0
  let i = 0
  while (i < text.length) {
    const c = text[i] as string
    if (c === '"' || c === "'" || c === '`') {
      i = scanString(text, i)
      continue
    }
    if (c === '/' && text[i + 1] === '/') {
      const nl = text.indexOf('\n', i)
      i = nl === -1 ? text.length : nl
      continue
    }
    if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2)
      i = end === -1 ? text.length : end + 2
      continue
    }
    if (c === '{') depth++
    else if (c === '}') depth--
    i++
  }
  return depth
}

/** Segment an mdx-lite document into imports / markdown / jsx blocks. */
export function segmentMdx(source: string): MdxBlock[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const blocks: MdxBlock[] = []
  let md: string[] = []
  let inFence = false
  let fence = ''

  const flushMd = (): void => {
    const text = md.join('\n').replace(/^\n+/, '').replace(/\n+$/, '')
    if (text.trim() !== '') blocks.push({ kind: 'markdown', text })
    md = []
  }

  let li = 0
  while (li < lines.length) {
    const line = lines[li] as string

    if (inFence) {
      md.push(line)
      if (FENCE.test(line) && line.trim().startsWith(fence)) inFence = false
      li++
      continue
    }

    const fenceMatch = FENCE.exec(line)
    if (fenceMatch) {
      inFence = true
      fence = fenceMatch[1] as string
      md.push(line)
      li++
      continue
    }

    if (IMPORT_EXPORT.test(line)) {
      flushMd()
      const start = li
      let stmt = line
      li++
      while (braceBalance(stmt) > 0 && li < lines.length) {
        stmt += `\n${lines[li]}`
        li++
      }
      // greedily absorb a run of further import/export statements
      const codeLines = lines.slice(start, li)
      while (li < lines.length && IMPORT_EXPORT.test(lines[li] as string)) {
        let next = lines[li] as string
        codeLines.push(next)
        li++
        while (braceBalance(next) > 0 && li < lines.length) {
          next += `\n${lines[li]}`
          codeLines.push(lines[li] as string)
          li++
        }
      }
      blocks.push({ kind: 'imports', code: codeLines.join('\n') })
      continue
    }

    if (JSX_BLOCK_START.test(line)) {
      flushMd()
      const rest = lines.slice(li).join('\n')
      const tags: string[] = []
      const end = scanElement(rest, 0, tags)
      const consumed = rest.slice(0, end)
      const nLines = consumed.split('\n').length
      const code = lines.slice(li, li + nLines).join('\n')
      blocks.push({ kind: 'jsx', code, tags })
      li += nLines
      continue
    }

    md.push(line)
    li++
  }
  flushMd()
  return blocks
}

// ----------------------------------------------------------------------------
// Compilation to TSX
// ----------------------------------------------------------------------------

/** Extract the local binding names introduced by import/export statements. */
export function extractBoundNames(code: string): Set<string> {
  const names = new Set<string>()
  // namespace: import * as N from …
  for (const m of code.matchAll(/import\s+\*\s+as\s+([A-Za-z_$][\w$]*)/g))
    names.add(m[1] as string)
  // default: import Name from … / import Name, { … } from …
  for (const m of code.matchAll(/import\s+([A-Za-z_$][\w$]*)\s*(?:,|from)/g))
    names.add(m[1] as string)
  // named: import … { a, b as c } from …
  for (const m of code.matchAll(/import[^{]*\{([^}]*)\}/g)) {
    for (const part of (m[1] as string).split(',')) {
      const seg = part.trim()
      if (!seg) continue
      const as = seg.split(/\s+as\s+/)
      names.add((as[1] ?? as[0] ?? '').trim())
    }
  }
  // export const/let/var/function/class Name
  for (const m of code.matchAll(
    /export\s+(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g,
  ))
    names.add(m[1] as string)
  names.delete('')
  return names
}

const indent = (text: string, pad: string): string =>
  text
    .split('\n')
    .map((l) => (l === '' ? l : pad + l))
    .join('\n')

/** Compile an mdx-lite document to a `.tsx` module source string. */
export function mdxToTsx(source: string, opts: MdxToTsxOptions = {}): string {
  const spec = opts.markdownSpecifier ?? 'markdown-to-jsx'
  const blocks = segmentMdx(source)

  const importsCode = blocks
    .filter(
      (b): b is Extract<MdxBlock, { kind: 'imports' }> => b.kind === 'imports',
    )
    .map((b) => b.code)
    .join('\n')
  const bound = extractBoundNames(importsCode)

  // Component tags used by JSX blocks but not imported → resolved from props.
  const used = new Set<string>()
  for (const b of blocks) {
    if (b.kind !== 'jsx') continue
    for (const t of b.tags) used.add(t)
  }
  const external = [...used].filter(
    (n) => /^[A-Z][\w]*$/.test(n) && !bound.has(n),
  )

  const body = blocks
    .map((b) => {
      if (b.kind === 'imports') return ''
      if (b.kind === 'markdown')
        return `<__Md options={__mdOpts}>{${JSON.stringify(b.text)}}</__Md>`
      return b.code
    })
    .filter((x) => x !== '')

  const destructure =
    external.length > 0
      ? `  const { ${external.join(', ')} } = __components\n`
      : ''

  return `// AUTO-GENERATED by display-case mdx-lite — do not edit.
import __Md from ${JSON.stringify(spec)}
${importsCode}

export default function MDXContent(props) {
  const __components = (props && props.components) || {}
${destructure}  const { h1: __h1, h2: __h2 } = __components
  const __ov = {}
  if (__h1) __ov.h1 = __h1
  if (__h2) __ov.h2 = __h2
  const __mdOpts = { disableParsingRawHTML: true, overrides: __ov }
  return (
    <>
${body.map((x) => indent(x, '      ')).join('\n')}
    </>
  )
}
`
}
