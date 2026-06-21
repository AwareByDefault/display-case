import { describe, expect, test } from 'bun:test'
import { blankComments } from './check-text'

describe('blankComments', () => {
  test('blanks a JS line comment to spaces, preserving length and the newline', () => {
    expect(blankComments('x//c\ny', false)).toBe('x   \ny')
  })

  test('blanks a block comment in both JS and CSS', () => {
    expect(blankComments('a/*c*/b', false)).toBe('a     b')
    expect(blankComments('a/*c*/b', true)).toBe('a     b')
  })

  test('a multi-line block comment keeps its newlines (line numbers stay put)', () => {
    expect(blankComments('a/*\n*/b', false)).toBe('a  \n  b')
  })

  test('CSS has no line comments: `//` is left untouched', () => {
    expect(blankComments('a//b', true)).toBe('a//b')
  })

  test('string contents are preserved verbatim (JS)', () => {
    // `//` and `/*` inside a string are data, not comments.
    expect(blankComments("a='//b'", false)).toBe("a='//b'")
    expect(blankComments("c:'/*x*/'", false)).toBe("c:'/*x*/'")
  })

  test('a token reference inside a string survives', () => {
    expect(blankComments("color:'var(--x)'", false)).toBe("color:'var(--x)'")
  })

  test('all three JS string delimiters are honored', () => {
    expect(blankComments('`a//b`', false)).toBe('`a//b`')
    expect(blankComments('"a//b"', false)).toBe('"a//b"')
    expect(blankComments("'a//b'", false)).toBe("'a//b'")
  })

  test('an escaped quote does not end the string early', () => {
    // The \' is part of the string, so the trailing // is still inside it.
    expect(blankComments("'a\\'//b'", false)).toBe("'a\\'//b'")
  })

  test('output length always equals input length', () => {
    const src = "const u = 'https://x' // note\n/* blk */ fn(arg)"
    expect(blankComments(src, false)).toHaveLength(src.length)
  })

  test('motivating case: a code token named in a comment is erased, real usage kept', () => {
    const out = blankComments('// <Demo> in prose\n<Demo/>', false)
    expect(out).not.toContain('<Demo>')
    expect(out).toContain('<Demo/>')
  })
})
