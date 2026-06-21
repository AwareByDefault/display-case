import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { Select } from './Select'

describe('Select', () => {
  test('renders an aria-hidden caret beside the native control', () => {
    const html = renderToStaticMarkup(<Select options={['a']} />)
    expect(html).toContain('class="dcui-select"')
    expect(html).toContain('class="dcui-select-el"')
    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('▾')
  })

  test('renders string options with value and label equal', () => {
    const html = renderToStaticMarkup(<Select options={['light', 'dark']} />)
    expect(html).toContain('<option value="light">light</option>')
    expect(html).toContain('<option value="dark">dark</option>')
  })

  test('renders object options with a distinct value and label', () => {
    const html = renderToStaticMarkup(
      <Select options={[{ value: 'sm', label: 'Small' }]} />,
    )
    expect(html).toContain('<option value="sm">Small</option>')
  })

  test('renders grouped options as optgroups', () => {
    const html = renderToStaticMarkup(
      <Select
        options={[
          {
            label: 'Devices',
            options: ['iPhone', { value: 'ipad', label: 'iPad' }],
          },
        ]}
      />,
    )
    expect(html).toContain('<optgroup label="Devices">')
    expect(html).toContain('<option value="iPhone">iPhone</option>')
    expect(html).toContain('<option value="ipad">iPad</option>')
  })

  test('arbitrary option children override the options prop', () => {
    const html = renderToStaticMarkup(
      <Select options={['ignored']}>
        <option value="custom">Custom</option>
      </Select>,
    )
    expect(html).toContain('<option value="custom">Custom</option>')
    expect(html).not.toContain('ignored')
  })

  test('disabling propagates to the native select element', () => {
    const html = renderToStaticMarkup(<Select options={['a']} disabled />)
    expect(html).toContain('disabled')
  })
})
