import { describe, expect, test } from 'bun:test'
import type { StyleEngine } from '../index'
import { renderWithStyles } from './collect-styles'

/** A stub engine that wraps the tree in a marker element and emits a tagged
 *  `<style>` whose body echoes a per-instance counter — so a fresh instance per
 *  render is observable (isolation), as is the wrap actually being applied. */
function markerEngine(key: string, counter: { n: number }): StyleEngine {
  return () => {
    const id = ++counter.n
    return {
      wrap: (node) => (
        <div data-wrapped={key} data-instance={id}>
          {node}
        </div>
      ),
      collect: (html) =>
        `<style data-engine="${key}" data-instance="${id}" data-saw-wrap="${html.includes(
          `data-wrapped="${key}"`,
        )}"></style>`,
    }
  }
}

describe('renderWithStyles', () => {
  test('no engines: plain render, empty headStyles (inert when unused)', () => {
    const { html, headStyles } = renderWithStyles(<p>hi</p>, undefined)
    expect(html).toBe('<p>hi</p>')
    expect(headStyles).toBe('')
  })

  test('empty engine array is also inert', () => {
    const { html, headStyles } = renderWithStyles(<p>hi</p>, [])
    expect(html).toBe('<p>hi</p>')
    expect(headStyles).toBe('')
  })

  test('applies wrap and captures collect output (which saw the wrapped markup)', () => {
    const counter = { n: 0 }
    const { html, headStyles } = renderWithStyles(<p>hi</p>, [
      markerEngine('emotion', counter),
    ])
    expect(html).toContain('data-wrapped="emotion"')
    expect(headStyles).toContain('data-engine="emotion"')
    // collect() received the rendered markup including the wrapper.
    expect(headStyles).toContain('data-saw-wrap="true"')
  })

  test('multiple engines nest in array order and concatenate their output', () => {
    const counter = { n: 0 }
    const { html, headStyles } = renderWithStyles(<p>hi</p>, [
      markerEngine('outer', counter),
      markerEngine('inner', counter),
    ])
    // First engine is outermost: <div outer><div inner><p/></div></div>.
    expect(html.indexOf('data-wrapped="outer"')).toBeLessThan(
      html.indexOf('data-wrapped="inner"'),
    )
    expect(headStyles).toContain('data-engine="outer"')
    expect(headStyles).toContain('data-engine="inner"')
  })

  test('factory runs once per render — a fresh, isolated store each time', () => {
    const counter = { n: 0 }
    const engine = markerEngine('x', counter)
    const a = renderWithStyles(<p>a</p>, [engine])
    const b = renderWithStyles(<p>b</p>, [engine])
    // Distinct instance ids prove the factory was re-invoked (not a shared store).
    expect(a.headStyles).toContain('data-instance="1"')
    expect(b.headStyles).toContain('data-instance="2"')
  })
})
