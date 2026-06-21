import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { Sidebar } from './Sidebar'

describe('Sidebar', () => {
  test('renders a nav landmark with a generic default label', () => {
    const html = renderToStaticMarkup(
      <Sidebar>
        <span>rows</span>
      </Sidebar>,
    )
    expect(html).toContain('<nav')
    expect(html).toContain('class="dcui-sidebar"')
    expect(html).toContain('aria-label="Navigation"')
    expect(html).toContain('rows')
  })

  test('uses a contextual landmark label when given', () => {
    const html = renderToStaticMarkup(<Sidebar label="Components">x</Sidebar>)
    expect(html).toContain('aria-label="Components"')
  })

  test('forwards arbitrary attributes to the nav element', () => {
    const html = renderToStaticMarkup(
      <Sidebar id="rail" data-testid="sidebar">
        x
      </Sidebar>,
    )
    expect(html).toContain('id="rail"')
    expect(html).toContain('data-testid="sidebar"')
  })
})
