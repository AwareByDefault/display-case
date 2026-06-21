/**
 * Shared text utilities for the static checks (tokens, structure …).
 *
 * These operate on raw source so the checks can scan for patterns — token
 * references, JSX usages — without a full parser, while ignoring text that only
 * *looks* like code (comments) and respecting text that must be read literally
 * (string contents).
 */

/**
 * Replace comment characters with spaces, preserving every offset and newline so
 * reported line/column numbers (and any index-based scanning) stay accurate.
 * String literals are copied verbatim because `var(--x)` inside a JS string
 * (`color: 'var(--x)'`) is a real reference, and `//` inside a string
 * (`'https://…'`) must not read as a comment.
 *
 * @param isCss When true, only `/* … *\/` block comments are stripped (CSS has
 *   no `//` line comments and no string-delimited `//`); when false, JS/TSX
 *   `//` line comments and `"`/`'`/`` ` `` strings are handled too.
 */
export function blankComments(text: string, isCss: boolean): string {
  let out = ''
  let inBlock = false
  let inLine = false
  let str: string | null = null
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    const c2 = text[i + 1]
    if (inBlock) {
      if (c === '*' && c2 === '/') {
        out += '  '
        i++
        inBlock = false
      } else {
        out += c === '\n' ? '\n' : ' '
      }
      continue
    }
    if (inLine) {
      if (c === '\n') {
        out += '\n'
        inLine = false
      } else {
        out += ' '
      }
      continue
    }
    if (str) {
      out += c
      if (c === '\\') {
        out += c2 ?? ''
        i++
      } else if (c === str) {
        str = null
      }
      continue
    }
    if (c === '/' && c2 === '*') {
      out += '  '
      i++
      inBlock = true
      continue
    }
    if (!isCss && c === '/' && c2 === '/') {
      out += '  '
      i++
      inLine = true
      continue
    }
    if (!isCss && (c === '"' || c === "'" || c === '`')) {
      str = c
      out += c
      continue
    }
    out += c
  }
  return out
}
