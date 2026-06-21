import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { RenderAddress } from './RenderAddress'

describe('RenderAddress', () => {
  test('renders the URL with a default GET method tag and a copy control', () => {
    const html = renderToStaticMarkup(
      <RenderAddress url="/render/button/default" />,
    )
    expect(html).toContain('class="dcui-address-method"')
    expect(html).toContain('>GET<')
    expect(html).toContain('/render/button/default')
    expect(html).toContain('aria-label="Copy address"')
  })

  test('renders the copy glyph in its un-copied resting state', () => {
    const html = renderToStaticMarkup(<RenderAddress url="/x" />)
    expect(html).toContain('⧉')
    expect(html).not.toContain('✓')
  })

  test('reflects a custom method tag', () => {
    const html = renderToStaticMarkup(<RenderAddress url="/x" method="POST" />)
    expect(html).toContain('>POST<')
  })
})
