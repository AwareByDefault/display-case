import { describe, expect, test } from 'bun:test'
import {
  defineCases,
  defineConfig,
  defineFlow,
  flowStep,
  HIERARCHY_LEVELS,
  tweak,
} from './index'

describe('tweak builders', () => {
  test('text defaults to an empty string and echoes a provided default', () => {
    expect(tweak.text()).toEqual({ kind: 'text', default: '' })
    expect(tweak.text('hi')).toEqual({ kind: 'text', default: 'hi' })
  })

  test('boolean defaults to false', () => {
    expect(tweak.boolean()).toEqual({ kind: 'boolean', default: false })
    expect(tweak.boolean(true)).toEqual({ kind: 'boolean', default: true })
  })

  test('number defaults to zero', () => {
    expect(tweak.number()).toEqual({ kind: 'number', default: 0 })
    expect(tweak.number(42)).toEqual({ kind: 'number', default: 42 })
  })

  test('choice records its options and default', () => {
    expect(tweak.choice(['sm', 'md', 'lg'], 'md')).toEqual({
      kind: 'choice',
      options: ['sm', 'md', 'lg'],
      default: 'md',
    })
  })
})

describe('defineCases', () => {
  test('builds a non-flow module from a name and cases', () => {
    const mod = defineCases('Button', { Default: () => null })
    expect(mod.component).toBe('Button')
    expect(mod.isFlow).toBe(false)
    expect(mod.level).toBeUndefined()
    expect(mod.area).toBeUndefined()
    expect(Object.keys(mod.cases)).toEqual(['Default'])
  })

  test('carries level and area from meta', () => {
    const mod = defineCases(
      'Button',
      { Default: () => null },
      {
        level: 'atom',
        area: 'marketing',
      },
    )
    expect(mod.level).toBe('atom')
    expect(mod.area).toBe('marketing')
  })
})

describe('defineFlow', () => {
  test('builds a flow module pinned at the flow level', () => {
    const mod = defineFlow('Sign In', {
      steps: { Start: flowStep({ render: () => null }) },
    })
    expect(mod.component).toBe('Sign In')
    expect(mod.isFlow).toBe(true)
    expect(mod.level).toBe('flow')
    expect(Object.keys(mod.cases)).toEqual(['Start'])
  })

  test('carries an area tag from config', () => {
    const mod = defineFlow('Sign In', { steps: {}, area: 'auth' })
    expect(mod.area).toBe('auth')
  })
})

describe('identity helpers', () => {
  test('flowStep returns its argument unchanged', () => {
    const step = { render: () => null }
    expect(flowStep(step)).toBe(step)
  })

  test('defineConfig returns its argument unchanged', () => {
    const config = { title: 'X', roots: ['**/*.case.tsx'] }
    expect(defineConfig(config)).toBe(config)
  })
})

describe('HIERARCHY_LEVELS', () => {
  test('orders the atomic-design levels from atom to flow', () => {
    expect(HIERARCHY_LEVELS).toEqual([
      'atom',
      'molecule',
      'organism',
      'template',
      'page',
      'flow',
    ])
  })
})
