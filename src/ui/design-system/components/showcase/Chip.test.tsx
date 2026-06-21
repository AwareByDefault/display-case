import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { Chip } from './Chip'

describe('Chip', () => {
  test('renders as a static span by default with the label as a title', () => {
    const html = renderToStaticMarkup(<Chip label="atom">atom</Chip>)
    expect(html).toContain('<span')
    expect(html).not.toContain('<button')
    expect(html).toContain('title="atom"')
    expect(html).toContain('data-variant="default"')
  })

  test('becomes a button when an onClick handler is given', () => {
    const html = renderToStaticMarkup(
      <Chip label="Step 1" onClick={() => {}}>
        Step 1
      </Chip>,
    )
    expect(html).toContain('<button')
    expect(html).toContain('type="button"')
    expect(html).toContain('aria-label="Step 1"')
  })

  test('marks the current chip with aria-current', () => {
    const current = renderToStaticMarkup(<Chip current>x</Chip>)
    const plain = renderToStaticMarkup(<Chip>x</Chip>)
    expect(current).toContain('aria-current="true"')
    expect(plain).not.toContain('aria-current')
  })

  test('renders a leading index slot when provided', () => {
    const html = renderToStaticMarkup(<Chip index={2}>Configure</Chip>)
    expect(html).toContain('class="dcui-chip-index"')
    expect(html).toContain('>2<')
  })

  test('reflects the variant', () => {
    expect(renderToStaticMarkup(<Chip variant="accent">x</Chip>)).toContain(
      'data-variant="accent"',
    )
    expect(renderToStaticMarkup(<Chip variant="solid">x</Chip>)).toContain(
      'data-variant="solid"',
    )
  })
})
