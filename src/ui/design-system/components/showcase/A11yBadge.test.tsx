import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { A11yBadge } from './A11yBadge'

describe('A11yBadge', () => {
  test('renders a numbered pill with a pluralized accessible name', () => {
    const html = renderToStaticMarkup(<A11yBadge value={3} />)
    expect(html).toContain('>3<')
    expect(html).toContain('aria-label="3 accessibility violations"')
    expect(html).toContain('role="img"')
    expect(html).not.toContain('data-dot')
  })

  test('uses the singular form for a single violation', () => {
    const html = renderToStaticMarkup(<A11yBadge value={1} />)
    expect(html).toContain('aria-label="1 accessibility violation"')
  })

  test('renders a bare, unnumbered dot for the "dot" value', () => {
    const html = renderToStaticMarkup(<A11yBadge value="dot" />)
    expect(html).toContain('data-dot="true"')
    expect(html).toContain(
      'aria-label="Has accessibility violations across variants"',
    )
  })

  test('threads through the optional test id', () => {
    const html = renderToStaticMarkup(<A11yBadge value={2} testId="badge-x" />)
    expect(html).toContain('data-testid="badge-x"')
  })
})
