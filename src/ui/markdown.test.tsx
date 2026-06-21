import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { DocMarkdown } from './markdown'

describe('DocMarkdown', () => {
  test('renders CommonMark prose inside the doc wrapper', () => {
    const html = renderToStaticMarkup(
      <DocMarkdown source={'# Title\n\nA **bold** word.'} />,
    )
    expect(html).toContain('class="dc-doc-md"')
    expect(html).toContain('<h1>Title</h1>')
    expect(html).toContain('<strong>bold</strong>')
  })

  test('applies GFM extensions like tables and strikethrough', () => {
    const html = renderToStaticMarkup(
      <DocMarkdown source={'| A | B |\n| - | - |\n| 1 | 2 |\n\n~~gone~~'} />,
    )
    expect(html).toContain('<table>')
    expect(html).toContain('<th>A</th>')
    expect(html).toContain('<del>gone</del>')
  })

  test('does not inject raw HTML from the source into the chrome', () => {
    const html = renderToStaticMarkup(
      <DocMarkdown source={'<script>alert(1)</script>\n\n<b>x</b>'} />,
    )
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<b>x</b>')
  })
})
