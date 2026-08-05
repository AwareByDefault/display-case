import { describe, expect, test } from 'bun:test'
import { type DisplayCaseConfig, defineCases, type StyleEngine } from '../index'
import { type DomFrame, domSubstrate } from '../substrate/dom'
import type { CaseTreeState } from './render-node'
import { makeCaseRenderer } from './ssr-render'

const NO_CONFIG: DisplayCaseConfig = {} as DisplayCaseConfig

/** A stub engine emitting a per-render-instance-tagged style tag. */
function stubEngine(counter: { n: number }): StyleEngine {
  return () => {
    const id = ++counter.n
    return {
      wrap: (node) => node,
      collect: () => `<style data-stub="${id}"></style>`,
    }
  }
}

const state = (over: Partial<CaseTreeState>): CaseTreeState => ({
  componentId: 'button',
  caseId: 'default',
  width: null,
  tweaks: {},
  ...over,
})

function Boom(): never {
  throw new Error('needs a browser')
}

/** Build a renderer over the DOM substrate — the default a showcase gets. */
function renderer(
  modules: Parameters<typeof makeCaseRenderer>[0],
  config = NO_CONFIG,
) {
  const render = makeCaseRenderer(modules, config, domSubstrate())
  // The substrate's frame is opaque to the renderer, but this suite is about the
  // DOM substrate specifically, so narrow it to read the markup back.
  return async (s: CaseTreeState) => {
    const result = await render(s)
    return { ...result, frame: result.frame as DomFrame }
  }
}

describe('makeCaseRenderer', () => {
  test('renders an SSR-able case to inner markup', async () => {
    const render = renderer([
      defineCases('Button', {
        Default: () => <button type="button">Hi</button>,
      }),
    ])
    const result = await render(state({}))
    expect(result.browserOnly).toBe(false)
    expect(result.frame.html).toContain('Hi')
    expect(result.error).toBeUndefined()
  })

  test('skips server rendering for a browser-only module without attempting it', async () => {
    const render = renderer([
      defineCases(
        'Canvas',
        { Default: () => <canvas /> },
        { browserOnly: true },
      ),
    ])
    const result = await render(state({ componentId: 'canvas' }))
    expect(result.browserOnly).toBe(true)
    expect(result.frame).toEqual({
      html: '',
      browserOnly: true,
      headStyles: '',
    })
  })

  test('catches a render that needs a browser and reports it browser-only with the error', async () => {
    const render = renderer([defineCases('Bad', { Default: () => <Boom /> })])
    const result = await render(state({ componentId: 'bad' }))
    expect(result.browserOnly).toBe(true)
    expect(result.frame.html).toBe('')
    expect(result.error).toContain('needs a browser')
  })

  test('renders the not-found node for an unknown case (not a browser-only fallback)', async () => {
    const render = renderer([])
    const result = await render(state({ componentId: 'ghost', caseId: 'x' }))
    expect(result.browserOnly).toBe(false)
    // renderToString interleaves `<!-- -->` markers between text nodes, so match
    // the stable wrapper + ids rather than the contiguous sentence.
    expect(result.frame.html).toContain('dc-render-missing')
    expect(result.frame.html).toContain('No such case:')
    expect(result.frame.html).toContain('ghost')
  })

  test('without a style engine, headStyles is empty (inert when unused)', async () => {
    const render = renderer([
      defineCases('Button', {
        Default: () => <button type="button">Hi</button>,
      }),
    ])
    expect((await render(state({}))).frame.headStyles).toBe('')
  })

  test('a configured style engine collects head styling for the render', async () => {
    const render = renderer(
      [
        defineCases('Button', {
          Default: () => <button type="button">Hi</button>,
        }),
      ],
      { ...NO_CONFIG, styleEngines: [stubEngine({ n: 0 })] },
    )
    const result = await render(state({}))
    expect(result.frame.html).toContain('Hi')
    expect(result.frame.headStyles).toContain('data-stub=')
  })

  test('each render gets its own isolated collector (no cross-case bleed)', async () => {
    const render = renderer(
      [
        defineCases('Button', {
          Default: () => <button type="button">Hi</button>,
        }),
        defineCases('Link', { Default: () => <a href="/x">Go</a> }),
      ],
      { ...NO_CONFIG, styleEngines: [stubEngine({ n: 0 })] },
    )
    const a = await render(state({ componentId: 'button' }))
    const b = await render(state({ componentId: 'link' }))
    // Distinct per-render instance ids ⇒ a fresh store per render, not shared.
    expect(a.frame.headStyles).toContain('data-stub="1"')
    expect(b.frame.headStyles).toContain('data-stub="2"')
  })

  test('a browser-only case runs no engine and emits no head styling', async () => {
    const render = renderer(
      [
        defineCases(
          'Canvas',
          { Default: () => <canvas /> },
          { browserOnly: true },
        ),
      ],
      { ...NO_CONFIG, styleEngines: [stubEngine({ n: 0 })] },
    )
    const result = await render(state({ componentId: 'canvas' }))
    expect(result.browserOnly).toBe(true)
    expect(result.frame.headStyles).toBe('')
  })

  test('a browser-only case never has its tree built, not merely never rendered', async () => {
    // A browser-only case may touch `document` in its own thunk — reading the
    // theme off the root to pick a provider mode, as the MUI fixture does — so
    // even *constructing* the tree throws. The opt-out has to happen before
    // that, or the server 500s instead of letting the client mount the case.
    let built = false
    const render = renderer([
      defineCases(
        'Themed',
        {
          Default: () => {
            built = true
            throw new ReferenceError('document is not defined')
          },
        },
        { browserOnly: true },
      ),
    ])
    const result = await render(state({ componentId: 'themed' }))
    expect(built).toBe(false)
    expect(result.browserOnly).toBe(true)
    expect(result.frame.html).toBe('')
  })

  test('a throw while building the tree falls back like a render throw', async () => {
    // Same fallback, but for a case that did NOT declare itself browser-only:
    // reported browser-only with the reason, rather than escaping to the host.
    const render = renderer([
      defineCases('Eager', {
        Default: () => {
          throw new Error('needs a browser at construction')
        },
      }),
    ])
    const result = await render(state({ componentId: 'eager' }))
    expect(result.browserOnly).toBe(true)
    expect(result.frame.html).toBe('')
    expect(result.error).toContain('needs a browser at construction')
  })

  test('fills render-axis defaults so an unspecified variant still renders', async () => {
    // The DOM substrate declares theme as a render axis defaulting to light; a
    // caller that names no variant must still get a complete, deterministic
    // context rather than an undefined theme.
    const render = makeCaseRenderer(
      [
        defineCases('Button', {
          Default: () => <button type="button">Hi</button>,
        }),
      ],
      NO_CONFIG,
      {
        ...domSubstrate(),
        render(_tree, ctx) {
          return {
            html: `theme=${ctx.variants.theme}`,
            browserOnly: false,
            headStyles: '',
          }
        },
      },
    )
    const result = await render(state({}))
    expect((result.frame as DomFrame).html).toBe('theme=light')
  })
})
