import { describe, expect, test } from 'bun:test'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { type DisplayCaseConfig, defineCases, tweak } from '../index'
import {
  type CaseTreeState,
  caseTree,
  encodeOverrides,
  resolveTweaks,
} from './render-node'

const schema = {
  label: tweak.text('Save'),
  size: tweak.choice(['sm', 'lg'], 'sm'),
  count: tweak.number(3),
  on: tweak.boolean(false),
}

// `resolveTweaks` is typed over the wide `TweakSchema`, so its return widens to
// an imprecise mapped type; assert against the concrete value shape this schema
// produces.
interface Resolved {
  label: string
  size: string
  count: number
  on: boolean
}
const resolve = (tweaks: Record<string, string>): Resolved =>
  resolveTweaks(schema, tweaks) as unknown as Resolved

const state = (over: Partial<CaseTreeState>): CaseTreeState => ({
  componentId: 'button',
  caseId: 'default',
  width: null,
  tweaks: {},
  ...over,
})

const NO_CONFIG: DisplayCaseConfig = {} as DisplayCaseConfig

describe('resolveTweaks', () => {
  test('falls back to each descriptor default when the key is absent', () => {
    expect(resolve({})).toEqual({
      label: 'Save',
      size: 'sm',
      count: 3,
      on: false,
    })
  })

  test('decodes booleans from "1"/"true" and treats anything else as false', () => {
    expect(resolve({ on: '1' }).on).toBe(true)
    expect(resolve({ on: 'true' }).on).toBe(true)
    expect(resolve({ on: '0' }).on).toBe(false)
    expect(resolve({ on: 'nope' }).on).toBe(false)
  })

  test('coerces numbers and passes text/choice through verbatim', () => {
    const v = resolve({ count: '42', label: 'Go', size: 'lg' })
    expect(v.count).toBe(42)
    expect(v.label).toBe('Go')
    expect(v.size).toBe('lg')
  })
})

describe('encodeOverrides', () => {
  test('returns an empty map for no overrides', () => {
    expect(encodeOverrides()).toEqual({})
    expect(encodeOverrides(undefined)).toEqual({})
  })

  test('serializes booleans to "1"/"0" and stringifies the rest', () => {
    expect(
      encodeOverrides({ on: true, off: false, count: 7, label: 'Go' }),
    ).toEqual({
      on: '1',
      off: '0',
      count: '7',
      label: 'Go',
    })
  })

  test('round-trips numbers and booleans back through resolveTweaks', () => {
    const decoded = resolve(encodeOverrides({ count: 42, on: true }))
    expect(decoded.count).toBe(42)
    expect(decoded.on).toBe(true)
  })
})

describe('caseTree', () => {
  const Noop = () => {}

  test('renders the not-found node when no such case exists', () => {
    const html = renderToStaticMarkup(
      caseTree(
        [],
        NO_CONFIG,
        state({ componentId: 'ghost', caseId: 'x' }),
        Noop,
      ),
    )
    expect(html).toContain('dc-render-missing')
    expect(html).toContain('No such case: ghost/x')
  })

  test('invokes a simple thunk case', () => {
    const modules = [
      defineCases('Button', {
        Default: () => <button type="button">Hi</button>,
      }),
    ]
    const html = renderToStaticMarkup(
      caseTree(modules, NO_CONFIG, state({}), Noop),
    )
    expect(html).toContain('<button')
    expect(html).toContain('Hi')
  })

  test('passes resolved tweak values into a tweaked case render', () => {
    const modules = [
      defineCases('Button', {
        Default: {
          tweaks: { label: tweak.text('Save') },
          render: (v) => <span>{v.label}</span>,
        },
      }),
    ]
    const html = renderToStaticMarkup(
      caseTree(
        modules,
        NO_CONFIG,
        state({ tweaks: { label: 'Custom' } }),
        Noop,
      ),
    )
    expect(html).toContain('<span>Custom</span>')
  })

  test('constrains the case to a max-width wrapper when width is set', () => {
    const modules = [defineCases('Button', { Default: () => <i>x</i> })]
    const html = renderToStaticMarkup(
      caseTree(modules, NO_CONFIG, state({ width: 320 }), Noop),
    )
    expect(html).toContain('max-width:320px')
  })

  test('wraps the case in the configured decorator', () => {
    const modules = [defineCases('Button', { Default: () => <i>x</i> })]
    const config = {
      decorator: ({ children }: { children: ReactNode }) => (
        <div className="deco">{children}</div>
      ),
    } as DisplayCaseConfig
    const html = renderToStaticMarkup(
      caseTree(modules, config, state({}), Noop),
    )
    expect(html).toContain('class="deco"')
    expect(html).toContain('<i>x</i>')
  })
})
