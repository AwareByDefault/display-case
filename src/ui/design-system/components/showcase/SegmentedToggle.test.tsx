import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { SegmentedToggle } from './SegmentedToggle'

const options = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
] as const

const noop = () => {}

describe('SegmentedToggle', () => {
  test('renders a labelled tablist of tabs', () => {
    const html = renderToStaticMarkup(
      <SegmentedToggle
        options={[...options]}
        value="light"
        onChange={noop}
        label="Theme"
      />,
    )
    expect(html).toContain('role="tablist"')
    expect(html).toContain('aria-label="Theme"')
    expect((html.match(/role="tab"/g) ?? []).length).toBe(3)
  })

  test('marks the selected option as the active, selected tab', () => {
    const html = renderToStaticMarkup(
      <SegmentedToggle
        options={[...options]}
        value="dark"
        onChange={noop}
        label="Theme"
      />,
    )
    // Exactly one tab is selected/active.
    expect((html.match(/aria-selected="true"/g) ?? []).length).toBe(1)
    expect((html.match(/data-active="true"/g) ?? []).length).toBe(1)
  })

  test('drives the thumb geometry from --seg-count and --seg-index', () => {
    const html = renderToStaticMarkup(
      <SegmentedToggle
        options={[...options]}
        value="system"
        onChange={noop}
        label="Theme"
      />,
    )
    expect(html).toContain('--seg-count:3')
    expect(html).toContain('--seg-index:2')
  })

  test('clamps an unknown value to the first cell rather than a negative index', () => {
    const html = renderToStaticMarkup(
      <SegmentedToggle
        options={[...options]}
        value={'gone' as never}
        onChange={noop}
        label="Theme"
      />,
    )
    expect(html).toContain('--seg-index:0')
    expect(html).not.toContain('aria-selected="true"')
  })

  test('applies a per-segment test id factory when given', () => {
    const html = renderToStaticMarkup(
      <SegmentedToggle
        options={[...options]}
        value="light"
        onChange={noop}
        label="Theme"
        testId={(id) => `seg-${id}`}
      />,
    )
    expect(html).toContain('data-testid="seg-light"')
    expect(html).toContain('data-testid="seg-system"')
  })
})
