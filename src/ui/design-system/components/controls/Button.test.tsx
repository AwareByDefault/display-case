import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { Button } from './Button'

describe('Button', () => {
  test('defaults to a ghost, medium, type=button control', () => {
    const html = renderToStaticMarkup(<Button>Go</Button>)
    expect(html).toContain('class="dcui-btn"')
    expect(html).toContain('data-variant="ghost"')
    expect(html).toContain('data-size="md"')
    expect(html).toContain('type="button"')
    expect(html).toContain('Go')
  })

  test('reflects the variant and size props as data attributes', () => {
    const html = renderToStaticMarkup(
      <Button variant="accent" size="lg">
        Buy
      </Button>,
    )
    expect(html).toContain('data-variant="accent"')
    expect(html).toContain('data-size="lg"')
  })

  test('a caller-supplied type overrides the button default', () => {
    const html = renderToStaticMarkup(<Button type="submit">Send</Button>)
    expect(html).toContain('type="submit"')
  })

  test('renders the marigold toggle-on state from aria-pressed', () => {
    const html = renderToStaticMarkup(<Button aria-pressed={true}>On</Button>)
    expect(html).toContain('aria-pressed="true"')
  })

  test('passes arbitrary button attributes through to the element', () => {
    const html = renderToStaticMarkup(
      <Button disabled data-testid="x" title="hint">
        Off
      </Button>,
    )
    expect(html).toContain('disabled')
    expect(html).toContain('data-testid="x"')
    expect(html).toContain('title="hint"')
  })
})
