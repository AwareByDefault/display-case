import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { IconButton } from './IconButton'

describe('IconButton', () => {
  test('renders the glyph and exposes the required label as the accessible name', () => {
    const html = renderToStaticMarkup(<IconButton glyph="☰" label="Menu" />)
    expect(html).toContain('class="dcui-iconbtn"')
    expect(html).toContain('aria-label="Menu"')
    expect(html).toContain('☰')
    expect(html).toContain('type="button"')
  })

  test('defaults to the outline variant at medium size', () => {
    const html = renderToStaticMarkup(<IconButton glyph="+" label="Add" />)
    expect(html).toContain('data-variant="outline"')
    expect(html).toContain('data-size="md"')
  })

  test('falls back to children when no glyph is given', () => {
    const html = renderToStaticMarkup(<IconButton label="Close">✕</IconButton>)
    expect(html).toContain('✕')
  })

  test('lights the active state via data-active only when active', () => {
    const on = renderToStaticMarkup(<IconButton glyph="●" label="On" active />)
    const off = renderToStaticMarkup(<IconButton glyph="●" label="Off" />)
    expect(on).toContain('data-active="true"')
    expect(off).not.toContain('data-active')
  })

  test('reflects the bare variant and size', () => {
    const html = renderToStaticMarkup(
      <IconButton glyph="⟲" label="Reset" variant="bare" size="sm" />,
    )
    expect(html).toContain('data-variant="bare"')
    expect(html).toContain('data-size="sm"')
  })
})
