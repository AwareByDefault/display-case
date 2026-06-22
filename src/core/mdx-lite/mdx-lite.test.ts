import { describe, expect, test } from 'bun:test'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { ComponentType } from 'react'
import {
  extractBoundNames,
  mdxToTsx,
  scanBraces,
  scanElement,
  scanString,
  segmentMdx,
} from './index'

const FIXTURES = join(import.meta.dir, '__fixtures__')

/** Assert the emitted TSX is syntactically valid by transpiling it with Bun's
 *  built-in transpiler (no extra deps). Throws on a syntax error. */
function assertValidTsx(code: string): void {
  const t = new Bun.Transpiler({ loader: 'tsx' })
  t.transformSync(code)
}

// ---------------------------------------------------------------------------
// Low-level scanners
// ---------------------------------------------------------------------------

describe('scanString', () => {
  test('plain strings and escapes', () => {
    expect(scanString(`"ab\\"c"x`, 0)).toBe(7)
    expect(scanString(`'a'`, 0)).toBe(3)
  })
  test('template with nested interpolation containing braces', () => {
    // Build the literal `a${ {x:1} }b` without a raw ${ token in source.
    const s = `\`a${'$'}{ {x:1} }b\``
    expect(scanString(s, 0)).toBe(s.length)
  })
})

describe('scanBraces', () => {
  test('nested object expression', () => {
    const s = '{{ a: 1, b: { c: 2 } }}rest'
    expect(s.slice(0, scanBraces(s, 0))).toBe('{{ a: 1, b: { c: 2 } }}')
  })
  test('braces inside strings are ignored', () => {
    const s = `{ "a}b" + '}' }tail`
    expect(s.slice(0, scanBraces(s, 0))).toBe(`{ "a}b" + '}' }`)
  })
  test('block and line comments containing braces', () => {
    const s = '{ /* } */ x } '
    expect(s.slice(0, scanBraces(s, 0))).toBe('{ /* } */ x }')
  })
})

describe('scanElement', () => {
  const end = (s: string) => {
    const tags: string[] = []
    return { i: scanElement(s, 0, tags), tags }
  }
  test('self-closing element', () => {
    const r = end('<Foo />after')
    expect('<Foo />after'.slice(0, r.i)).toBe('<Foo />')
    expect(r.tags).toEqual(['Foo'])
  })
  test('attributes with > and < inside strings', () => {
    const s = '<Foo title="a > b" data-x="<3">hi</Foo>!'
    expect(s.slice(0, end(s).i)).toBe('<Foo title="a > b" data-x="<3">hi</Foo>')
  })
  test('object expression prop with nested braces', () => {
    const s = '<W style={{ fontSize: "1rem", x: { y: 2 } }}>t</W>z'
    expect(s.slice(0, end(s).i)).toBe(
      '<W style={{ fontSize: "1rem", x: { y: 2 } }}>t</W>',
    )
  })
  test('nested same-name elements track depth', () => {
    const s = '<Box><Box><Box/></Box></Box>tail'
    expect(s.slice(0, end(s).i)).toBe('<Box><Box><Box/></Box></Box>')
  })
  test('fragment shorthand', () => {
    const s = '<><A/><B/></>x'
    const r = end(s)
    expect(s.slice(0, r.i)).toBe('<><A/><B/></>')
    expect(r.tags).toEqual(['A', 'B'])
  })
  test('JSX expression comment containing delimiters', () => {
    const s = '<A>{/* < } > */}done</A>!'
    expect(s.slice(0, end(s).i)).toBe('<A>{/* < } > */}done</A>')
  })
  test('spread attribute', () => {
    const s = '<A {...props} b="1"/>z'
    expect(s.slice(0, end(s).i)).toBe('<A {...props} b="1"/>')
  })
  test('multi-line element with blank lines in the body', () => {
    const s = '<Box>\n\n  <A/>\n\n  <B/>\n\n</Box>\ntrailing'
    const r = end(s)
    expect(s.slice(0, r.i)).toBe('<Box>\n\n  <A/>\n\n  <B/>\n\n</Box>')
    expect(r.tags).toEqual(['Box', 'A', 'B'])
  })
})

describe('extractBoundNames', () => {
  test('default, named, aliased, namespace, and export bindings', () => {
    const code = [
      "import Def from './a'",
      "import { x, y as z } from './b'",
      "import Mix, { q } from './c'",
      "import * as NS from './d'",
      'export const Local = 1',
    ].join('\n')
    const names = extractBoundNames(code)
    expect([...names].sort()).toEqual(
      ['Def', 'Local', 'Mix', 'NS', 'q', 'x', 'z'].sort(),
    )
  })
})

// ---------------------------------------------------------------------------
// Segmentation
// ---------------------------------------------------------------------------

describe('segmentMdx', () => {
  test('classifies imports, prose, and block JSX', () => {
    const blocks = segmentMdx(
      [
        "import { Button } from './c'",
        '',
        '# Title',
        '',
        'Some **bold** prose.',
        '',
        '<Display title="x"><Button/></Display>',
        '',
        'After.',
      ].join('\n'),
    )
    expect(blocks.map((b) => b.kind)).toEqual([
      'imports',
      'markdown',
      'jsx',
      'markdown',
    ])
    const jsx = blocks[2] as Extract<(typeof blocks)[number], { kind: 'jsx' }>
    expect(jsx.tags).toEqual(['Display', 'Button'])
  })

  test('fenced code containing <Tag> stays markdown, not JSX', () => {
    const blocks = segmentMdx(
      ['```mdx', '<Display title="x">', '  <Foo/>', '</Display>', '```'].join(
        '\n',
      ),
    )
    expect(blocks).toHaveLength(1)
    expect(blocks[0]?.kind).toBe('markdown')
  })

  test('multi-line named import is one imports block', () => {
    const blocks = segmentMdx(
      ['import {', '  A,', '  B,', '} from "./x"', '', 'prose'].join('\n'),
    )
    expect(blocks[0]?.kind).toBe('imports')
    expect((blocks[0] as { code: string }).code).toContain('B,')
    expect(blocks[1]?.kind).toBe('markdown')
  })

  test('multi-line JSX block with blank lines inside is one jsx block', () => {
    const blocks = segmentMdx(
      [
        '<Display title="t">',
        '',
        '  <A/>',
        '',
        '  <B/>',
        '',
        '</Display>',
      ].join('\n'),
    )
    expect(blocks).toHaveLength(1)
    expect(blocks[0]?.kind).toBe('jsx')
  })

  test('prose line starting with lowercase < or autolink is not JSX', () => {
    const blocks = segmentMdx('see <https://example.com> and a < b here')
    expect(blocks).toHaveLength(1)
    expect(blocks[0]?.kind).toBe('markdown')
  })

  test('degenerate inputs', () => {
    expect(segmentMdx('')).toEqual([])
    expect(segmentMdx('   \n\n  ')).toEqual([])
    expect(segmentMdx("import x from './x'").map((b) => b.kind)).toEqual([
      'imports',
    ])
    expect(segmentMdx('<A/>').map((b) => b.kind)).toEqual(['jsx'])
    expect(segmentMdx('just prose').map((b) => b.kind)).toEqual(['markdown'])
  })

  test('CRLF newlines are normalized', () => {
    const blocks = segmentMdx('# T\r\n\r\nbody')
    expect(blocks).toHaveLength(1)
    expect((blocks[0] as { text: string }).text).toBe('# T\n\nbody')
  })
})

// ---------------------------------------------------------------------------
// Compilation to TSX
// ---------------------------------------------------------------------------

describe('mdxToTsx', () => {
  test('emits a valid default-export component', () => {
    const code = mdxToTsx(
      [
        "import { Button } from './c'",
        '',
        '# Hi',
        '',
        '<Display><Button/></Display>',
      ].join('\n'),
    )
    assertValidTsx(code)
    expect(code).toContain('export default function MDXContent')
    expect(code).toContain("import { Button } from './c'")
    // Display is not imported → resolved from the components prop.
    expect(code).toContain('const { Display } = __components')
    // Button is imported → NOT destructured from components.
    expect(code).not.toContain('Button } = __components')
  })

  test('markdown payload is embedded as a JSON-safe string', () => {
    // Prose containing backticks and a dollar-brace must not corrupt the TSX.
    const code = mdxToTsx(
      `a \`code\` and ${'$'}{not interpolated} and a "quote"`,
    )
    assertValidTsx(code)
    expect(code).toContain('<__Md options={__mdOpts}>')
  })

  test('no external components → no empty destructure', () => {
    const code = mdxToTsx("import { A } from './a'\n\n<A/>")
    assertValidTsx(code)
    expect(code).not.toContain('= __components\n  const { h1')
    expect(code).not.toContain('{  } = __components')
  })
})

// ---------------------------------------------------------------------------
// End-to-end SSR round-trips
// ---------------------------------------------------------------------------

describe('SSR round-trip (synthetic)', () => {
  test('imports resolve, prose renders, JSX specimens render', async () => {
    const src = [
      "import { Box } from './box-stub'",
      '',
      '# Heading',
      '',
      'Some **prose** here.',
      '',
      '<Display title="Demo"><Box>inner</Box></Display>',
    ].join('\n')
    const code = mdxToTsx(src, { markdownSpecifier: 'markdown-to-jsx' })
    const tmp = join(FIXTURES, `__rt_${Date.now()}.tsx`)
    await Bun.write(tmp, code)
    try {
      const { renderToStaticMarkup } = await import('react-dom/server')
      const { createElement } = await import('react')
      const mod = (await import(tmp)) as {
        default: ComponentType<{ components?: unknown }>
      }
      const Display = ({
        title,
        children,
      }: {
        title?: string
        children?: unknown
      }) =>
        createElement(
          'section',
          { 'data-display': '', title },
          children as never,
        )
      const html = renderToStaticMarkup(
        createElement(mod.default, { components: { Display } }) as never,
      )
      expect(html).toContain('<strong>prose</strong>') // prose via markdown-to-jsx
      expect(html).toContain('data-display') // Display resolved from components
      expect(html).toContain('data-box') // imported Box rendered
      expect(html).toContain('inner')
    } finally {
      await rm(tmp, { force: true })
    }
  })
})

describe('SSR round-trip (real primer.mdx)', () => {
  const Primer = join(
    import.meta.dir,
    '..',
    '..',
    'ui',
    'design-system',
    'primer.mdx',
  )

  test('the real primer segments, counts Display specimens, and emits valid TSX', async () => {
    const source = await Bun.file(Primer).text()
    const blocks = segmentMdx(source)
    const displays = blocks
      .filter((b) => b.kind === 'jsx')
      .filter((b) => (b as { tags: string[] }).tags[0] === 'Display').length
    expect(displays).toBeGreaterThanOrEqual(15)
    // prose exists
    expect(blocks.some((b) => b.kind === 'markdown')).toBe(true)
    assertValidTsx(mdxToTsx(source))
  })

  test('the real primer renders to HTML under SSR with a stubbed Display', async () => {
    const source = await Bun.file(Primer).text()
    const code = mdxToTsx(source, { markdownSpecifier: 'markdown-to-jsx' })
    // Write next to primer.mdx so its relative imports (./components, etc.) resolve.
    const tmp = join(
      import.meta.dir,
      '..',
      '..',
      'ui',
      'design-system',
      `__rt_primer_${Date.now()}.tsx`,
    )
    await Bun.write(tmp, code)
    try {
      const { renderToStaticMarkup } = await import('react-dom/server')
      const { createElement } = await import('react')
      const mod = (await import(tmp)) as {
        default: ComponentType<{ components?: unknown }>
      }
      const Display = ({ children }: { children?: unknown }) =>
        createElement('section', { 'data-display': '' }, children as never)
      const html = renderToStaticMarkup(
        createElement(mod.default, { components: { Display } }) as never,
      )
      expect(html).toContain('data-display')
      expect(html).toContain('Design System') // a heading from the prose
    } finally {
      await rm(tmp, { force: true })
    }
  })
})
