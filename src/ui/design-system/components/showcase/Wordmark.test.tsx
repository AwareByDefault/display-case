import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { Wordmark } from './Wordmark'

describe('Wordmark', () => {
  test('wraps the text in the bracketed wordmark shell', () => {
    const html = renderToStaticMarkup(<Wordmark>Display Case</Wordmark>)
    expect(html).toContain('class="dcui-wordmark"')
    expect(html).toContain('class="dcui-wordmark-text"')
    expect(html).toContain('Display Case')
  })

  test('forwards arbitrary attributes to the root element', () => {
    const html = renderToStaticMarkup(
      <Wordmark id="brand" title="Display Case">
        DC
      </Wordmark>,
    )
    expect(html).toContain('id="brand"')
    expect(html).toContain('title="Display Case"')
  })
})
