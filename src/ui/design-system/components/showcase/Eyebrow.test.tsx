import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { Eyebrow } from './Eyebrow'

describe('Eyebrow', () => {
  test('renders a muted div by default', () => {
    const html = renderToStaticMarkup(<Eyebrow>Tweaks</Eyebrow>)
    expect(html).toContain('<div')
    expect(html).toContain('class="dcui-eyebrow"')
    expect(html).toContain('data-tone="muted"')
    expect(html).toContain('Tweaks')
  })

  test('renders with the requested element tag', () => {
    const html = renderToStaticMarkup(<Eyebrow as="span">Docs</Eyebrow>)
    expect(html).toContain('<span')
    expect(html).not.toContain('<div')
  })

  test('reflects the tone', () => {
    expect(renderToStaticMarkup(<Eyebrow tone="accent">x</Eyebrow>)).toContain(
      'data-tone="accent"',
    )
    expect(renderToStaticMarkup(<Eyebrow tone="strong">x</Eyebrow>)).toContain(
      'data-tone="strong"',
    )
  })

  test('forwards arbitrary attributes to the element', () => {
    const html = renderToStaticMarkup(
      <Eyebrow id="section-label" title="hint">
        x
      </Eyebrow>,
    )
    expect(html).toContain('id="section-label"')
    expect(html).toContain('title="hint"')
  })
})
