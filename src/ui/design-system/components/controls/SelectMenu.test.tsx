import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { SelectMenu } from './SelectMenu'

// The popup listbox is portaled to document.body and only mounts while open;
// SSR renders the closed trigger, so these assert the combobox's resting state.
const noop = () => {}

describe('SelectMenu', () => {
  test('renders a closed combobox trigger with the listbox wiring', () => {
    const html = renderToStaticMarkup(
      <SelectMenu
        options={['light', 'dark']}
        value="light"
        onChange={noop}
        aria-label="Theme"
      />,
    )
    expect(html).toContain('role="combobox"')
    expect(html).toContain('aria-haspopup="listbox"')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('aria-label="Theme"')
  })

  test('shows the selected option label in the trigger', () => {
    const html = renderToStaticMarkup(
      <SelectMenu
        options={[{ value: 'dark', label: 'Dark mode' }, 'light']}
        value="dark"
        onChange={noop}
      />,
    )
    expect(html).toContain('Dark mode')
  })

  test('does not render the popup listbox while closed', () => {
    const html = renderToStaticMarkup(
      <SelectMenu options={['a', 'b']} value="a" onChange={noop} />,
    )
    expect(html).not.toContain('role="listbox"')
    expect(html).not.toContain('role="option"')
  })

  test('an unknown value falls back to the first selectable option label', () => {
    const html = renderToStaticMarkup(
      <SelectMenu
        options={[
          { value: 'h', label: 'Group', disabled: true },
          { value: 'one', label: 'First' },
        ]}
        value="nope"
        onChange={noop}
      />,
    )
    // The disabled header is skipped, so the first real option leads.
    expect(html).toContain('First')
  })

  test('a disabled menu is taken out of the tab order and marked aria-disabled', () => {
    const html = renderToStaticMarkup(
      <SelectMenu options={['a']} value="a" onChange={noop} disabled />,
    )
    expect(html).toContain('aria-disabled="true"')
    expect(html).toContain('tabindex="-1"')
  })
})
