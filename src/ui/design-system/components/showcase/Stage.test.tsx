import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { Stage } from './Stage'

describe('Stage', () => {
  test('renders the framed body with four corner ticks by default', () => {
    const html = renderToStaticMarkup(
      <Stage frame="hug">
        <p>exhibit</p>
      </Stage>,
    )
    expect(html).toContain('class="dcui-stage"')
    expect(html).toContain('data-frame="hug"')
    expect(html).toContain('class="dcui-stage-body"')
    expect((html.match(/dcui-stage-corner/g) ?? []).length).toBe(4)
    expect(html).toContain('exhibit')
  })

  test('omits the corner ticks when corners is false', () => {
    const html = renderToStaticMarkup(
      <Stage frame="fill" corners={false}>
        x
      </Stage>,
    )
    expect(html).not.toContain('dcui-stage-corner')
    expect(html).toContain('data-frame="fill"')
  })

  test('enables the dotted grid only when grid is set', () => {
    expect(
      renderToStaticMarkup(
        <Stage frame="hug" grid>
          x
        </Stage>,
      ),
    ).toContain('data-grid="true"')
    expect(renderToStaticMarkup(<Stage frame="hug">x</Stage>)).not.toContain(
      'data-grid',
    )
  })

  test('renders the caption strip with optional meta only when a caption is given', () => {
    const withCaption = renderToStaticMarkup(
      <Stage frame="hug" caption="Button" meta="atom">
        x
      </Stage>,
    )
    expect(withCaption).toContain('dcui-stage-caption')
    expect(withCaption).toContain('Button')
    expect(withCaption).toContain('dcui-stage-caption-meta')
    expect(withCaption).toContain('atom')

    const noCaption = renderToStaticMarkup(<Stage frame="hug">x</Stage>)
    expect(noCaption).not.toContain('dcui-stage-caption')
  })

  test('omits the meta span when no caption meta is provided', () => {
    const html = renderToStaticMarkup(
      <Stage frame="hug" caption="Button">
        x
      </Stage>,
    )
    expect(html).toContain('dcui-stage-caption')
    expect(html).not.toContain('dcui-stage-caption-meta')
  })

  test('applies dynamic grid-margin padding to the body when both pads are set', () => {
    const html = renderToStaticMarkup(
      <Stage frame="hug" padX={4} padY={8}>
        x
      </Stage>,
    )
    expect(html).toContain('padding:8px 4px')
  })

  test('overrides the body backdrop via the surface prop', () => {
    const html = renderToStaticMarkup(
      <Stage frame="fill" surface="#123456">
        x
      </Stage>,
    )
    expect(html).toContain('background:#123456')
  })
})
