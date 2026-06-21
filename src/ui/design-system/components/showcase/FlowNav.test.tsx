import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { FlowNav, type FlowStep } from './FlowNav'

const steps: FlowStep[] = [
  { id: 'a', label: 'Empty' },
  { id: 'b', label: 'Filled' },
  { id: 'c', label: 'Submitted' },
]

describe('FlowNav', () => {
  test('renders one numbered step chip per step', () => {
    const html = renderToStaticMarkup(<FlowNav steps={steps} activeId="a" />)
    expect(html).toContain('Empty')
    expect(html).toContain('Filled')
    expect(html).toContain('Submitted')
    // The mono index column on each chip.
    expect((html.match(/dcui-chip-index/g) ?? []).length).toBe(3)
  })

  test('marks the active step chip as current', () => {
    const html = renderToStaticMarkup(<FlowNav steps={steps} activeId="b" />)
    expect(html).toContain('aria-current="true"')
  })

  test('disables Prev on the first step', () => {
    const html = renderToStaticMarkup(<FlowNav steps={steps} activeId="a" />)
    // The Prev button (← Prev) precedes Next and is the only disabled control.
    const prevIdx = html.indexOf('← Prev')
    const slice = html.slice(0, prevIdx)
    expect(slice.lastIndexOf('disabled')).toBeGreaterThan(
      slice.lastIndexOf('<button'),
    )
  })

  test('disables Next on the last step but not Prev', () => {
    const html = renderToStaticMarkup(<FlowNav steps={steps} activeId="c" />)
    expect(html).toContain('← Prev')
    expect(html).toContain('Next →')
    // Exactly one rail button is disabled at an end.
    expect((html.match(/disabled/g) ?? []).length).toBe(1)
  })

  test('enables both rail buttons in the middle of the flow', () => {
    const html = renderToStaticMarkup(<FlowNav steps={steps} activeId="b" />)
    expect(html).not.toContain('disabled')
  })
})
