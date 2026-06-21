import { describe, expect, test } from 'bun:test'
import { type DisplayCaseConfig, defineCases } from '../index'
import type { CaseTreeState } from './render-node'
import { makeCaseRenderer } from './ssr-render'

const NO_CONFIG: DisplayCaseConfig = {} as DisplayCaseConfig

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

describe('makeCaseRenderer', () => {
  test('renders an SSR-able case to inner markup', () => {
    const render = makeCaseRenderer(
      [
        defineCases('Button', {
          Default: () => <button type="button">Hi</button>,
        }),
      ],
      NO_CONFIG,
    )
    const result = render(state({}))
    expect(result.browserOnly).toBe(false)
    expect(result.html).toContain('Hi')
    expect(result.error).toBeUndefined()
  })

  test('skips server rendering for a browser-only module without attempting it', () => {
    const render = makeCaseRenderer(
      [
        defineCases(
          'Canvas',
          { Default: () => <canvas /> },
          { browserOnly: true },
        ),
      ],
      NO_CONFIG,
    )
    const result = render(state({ componentId: 'canvas' }))
    expect(result).toEqual({ html: '', browserOnly: true })
  })

  test('catches a render that needs a browser and reports it browser-only with the error', () => {
    const render = makeCaseRenderer(
      [defineCases('Bad', { Default: () => <Boom /> })],
      NO_CONFIG,
    )
    const result = render(state({ componentId: 'bad' }))
    expect(result.browserOnly).toBe(true)
    expect(result.html).toBe('')
    expect(result.error).toContain('needs a browser')
  })

  test('renders the not-found node for an unknown case (not a browser-only fallback)', () => {
    const render = makeCaseRenderer([], NO_CONFIG)
    const result = render(state({ componentId: 'ghost', caseId: 'x' }))
    expect(result.browserOnly).toBe(false)
    // renderToString interleaves `<!-- -->` markers between text nodes, so match
    // the stable wrapper + ids rather than the contiguous sentence.
    expect(result.html).toContain('dc-render-missing')
    expect(result.html).toContain('No such case:')
    expect(result.html).toContain('ghost')
  })
})
