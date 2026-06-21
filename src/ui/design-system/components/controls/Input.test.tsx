import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { Input } from './Input'

describe('Input', () => {
  test('wraps a borderless input in the field shell at the default size', () => {
    const html = renderToStaticMarkup(<Input placeholder="name" />)
    expect(html).toContain('class="dcui-field"')
    expect(html).toContain('data-size="md"')
    expect(html).toContain('class="dcui-field-input"')
    expect(html).toContain('placeholder="name"')
  })

  test('renders the prefix and suffix affix slots only when provided', () => {
    const both = renderToStaticMarkup(<Input prefix="W" suffix="px" />)
    const affixes = both.match(/dcui-field-affix/g) ?? []
    expect(affixes).toHaveLength(2)
    expect(both).toContain('>W<')
    expect(both).toContain('>px<')

    const none = renderToStaticMarkup(<Input />)
    expect(none).not.toContain('dcui-field-affix')
  })

  test('disabling marks the wrapper aria-disabled and the input disabled', () => {
    const html = renderToStaticMarkup(<Input disabled />)
    expect(html).toContain('aria-disabled="true"')
    expect(html).toContain('disabled')
  })

  test('appends a caller class to the wrapper rather than replacing it', () => {
    const html = renderToStaticMarkup(<Input wrapperClassName="w-32" />)
    expect(html).toContain('class="dcui-field w-32"')
  })

  test('forwards native input attributes to the inner field', () => {
    const html = renderToStaticMarkup(
      <Input type="number" value={800} readOnly />,
    )
    expect(html).toContain('type="number"')
    expect(html).toContain('value="800"')
  })
})
