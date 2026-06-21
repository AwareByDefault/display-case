import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import type { A11yViolation } from '../../../../index'
import { A11yPanel } from './A11yPanel'

const violation = (over: Partial<A11yViolation>): A11yViolation => ({
  id: 'color-contrast',
  help: 'Elements must meet contrast',
  impact: 'serious',
  nodes: 1,
  ...over,
})

describe('A11yPanel', () => {
  test('shows a pending scan as the "Scanning…" state', () => {
    const html = renderToStaticMarkup(<A11yPanel violations="pending" />)
    expect(html).toContain('data-state="pending"')
    expect(html).toContain('Scanning…')
  })

  test('shows the unavailable state when the scan cannot run', () => {
    const html = renderToStaticMarkup(<A11yPanel violations="unavailable" />)
    expect(html).toContain('data-state="unavailable"')
    expect(html).toContain('Unavailable')
  })

  test('an empty array is a clean pass', () => {
    const html = renderToStaticMarkup(<A11yPanel violations={[]} />)
    expect(html).toContain('data-state="pass"')
    expect(html).toContain('Passes WCAG A/AA')
  })

  test('violations render the fail state with a pluralized count', () => {
    const one = renderToStaticMarkup(<A11yPanel violations={[violation({})]} />)
    expect(one).toContain('data-state="fail"')
    expect(one).toContain('1 violation')

    const many = renderToStaticMarkup(
      <A11yPanel
        violations={[violation({ id: 'a' }), violation({ id: 'b' })]}
      />,
    )
    expect(many).toContain('2 violations')
  })

  test('orders the list worst-impact first, then most-affected first', () => {
    const html = renderToStaticMarkup(
      <A11yPanel
        violations={[
          violation({ id: 'minor-one', impact: 'minor', nodes: 9 }),
          violation({ id: 'critical-one', impact: 'critical', nodes: 1 }),
          violation({ id: 'serious-few', impact: 'serious', nodes: 2 }),
          violation({ id: 'serious-many', impact: 'serious', nodes: 8 }),
        ]}
      />,
    )
    const order = [
      'critical-one',
      'serious-many',
      'serious-few',
      'minor-one',
    ].map((id) => html.indexOf(id))
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })

  test('renders the re-scan control only when a handler is wired', () => {
    const withRescan = renderToStaticMarkup(
      <A11yPanel violations={[]} onRescan={() => {}} />,
    )
    const without = renderToStaticMarkup(<A11yPanel violations={[]} />)
    expect(withRescan).toContain('Re-scan accessibility')
    expect(without).not.toContain('Re-scan accessibility')
  })

  test('hides the re-scan control while a scan is pending', () => {
    const html = renderToStaticMarkup(
      <A11yPanel violations="pending" onRescan={() => {}} />,
    )
    expect(html).not.toContain('Re-scan accessibility')
  })
})
