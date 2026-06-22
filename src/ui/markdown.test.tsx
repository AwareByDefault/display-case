import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { DocMarkdown } from './markdown'

describe('DocMarkdown', () => {
  test('renders the placard CommonMark + GFM subset', () => {
    const html = renderToStaticMarkup(
      <DocMarkdown
        source={[
          '# Title',
          '',
          'A **bold** and *italic* word with `code`.',
          '',
          '- one',
          '- two',
          '',
          '[link](https://example.com)',
          '',
          '```ts',
          'const x = 1',
          '```',
        ].join('\n')}
      />,
    )
    expect(html).toContain('class="dc-doc-md"')
    expect(html).toMatch(/<h1[^>]*>Title<\/h1>/)
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<em>italic</em>')
    expect(html).toContain('<code>code</code>')
    expect(html).toContain('<li>one</li>')
    expect(html).toMatch(/<a[^>]*href="https:\/\/example\.com"/)
    expect(html).toContain('<pre>')
    expect(html).toContain('const x = 1')
  })

  test('applies GFM extensions like tables and strikethrough', () => {
    const html = renderToStaticMarkup(
      <DocMarkdown source={'| A | B |\n| - | - |\n| 1 | 2 |\n\n~~gone~~'} />,
    )
    expect(html).toMatch(/<table/)
    expect(html).toMatch(/<th[^>]*>A<\/th>/)
    expect(html).toMatch(/<td[^>]*>1<\/td>/)
    expect(html).toContain('<del>gone</del>')
  })

  test('does not inject raw HTML from the source into the chrome', () => {
    const html = renderToStaticMarkup(
      <DocMarkdown source={'<script>alert(1)</script>\n\n<b>x</b> text'} />,
    )
    // disableParsingRawHTML: tags are escaped to text, never live elements.
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<b>x</b>')
  })
})
