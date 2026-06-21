import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { NavItem } from './NavItem'

describe('NavItem', () => {
  test('a toggleable component row leads with a disclosure chevron', () => {
    const html = renderToStaticMarkup(
      <NavItem label="Button" expanded={false} onToggle={() => {}} count={3} />,
    )
    expect(html).toContain('class="dcui-nav-disclosure"')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('aria-label="Expand Button"')
    expect(html).toContain('data-kind="component"')
  })

  test('the chevron aria-label flips with the expanded state', () => {
    const html = renderToStaticMarkup(
      <NavItem label="Button" expanded onToggle={() => {}} />,
    )
    expect(html).toContain('aria-label="Collapse Button"')
    expect(html).toContain('data-expanded="true"')
  })

  test('a single-case component row swaps the chevron for an aligning spacer', () => {
    const html = renderToStaticMarkup(<NavItem label="Solo" />)
    expect(html).toContain('class="dcui-nav-disclosure-spacer"')
    expect(html).not.toContain('class="dcui-nav-disclosure"')
  })

  test('a case row is indented and carries no disclosure', () => {
    const html = renderToStaticMarkup(<NavItem kind="case" label="default" />)
    expect(html).toContain('data-kind="case"')
    expect(html).not.toContain('dcui-nav-disclosure')
  })

  test('the active row sets data-current and aria-current', () => {
    const html = renderToStaticMarkup(<NavItem label="Button" current />)
    expect(html).toContain('data-current="true"')
    expect(html).toContain('aria-current="true"')
  })

  test('renders the a11y badge only for a positive count or "dot"', () => {
    expect(renderToStaticMarkup(<NavItem label="x" alert={2} />)).toContain(
      'dcui-a11y-badge',
    )
    expect(renderToStaticMarkup(<NavItem label="x" alert="dot" />)).toContain(
      'data-dot="true"',
    )
    expect(renderToStaticMarkup(<NavItem label="x" alert={0} />)).not.toContain(
      'dcui-a11y-badge',
    )
    expect(renderToStaticMarkup(<NavItem label="x" />)).not.toContain(
      'dcui-a11y-badge',
    )
  })

  test('renders the case count only when provided', () => {
    expect(
      renderToStaticMarkup(<NavItem label="x" onToggle={() => {}} count={5} />),
    ).toContain('dcui-nav-count')
    expect(
      renderToStaticMarkup(<NavItem label="x" onToggle={() => {}} />),
    ).not.toContain('dcui-nav-count')
  })
})
