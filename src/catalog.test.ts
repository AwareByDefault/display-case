import { describe, expect, test } from 'bun:test'
import { buildCatalog, findCase, slugify } from './catalog'
import type { CaseModule } from './index'
import { defineCases, defineFlow, flowStep, tweak } from './index'

describe('slugify', () => {
  test('lowercases and kebabs whitespace', () => {
    expect(slugify('Sign In Form')).toBe('sign-in-form')
  })

  test('collapses runs of non-alphanumerics into a single dash', () => {
    expect(slugify('Hello   World!!!')).toBe('hello-world')
  })

  test('strips leading and trailing separators', () => {
    expect(slugify('  --Button--  ')).toBe('button')
  })

  test('keeps an existing hyphen inside a name', () => {
    expect(slugify('Sign-in')).toBe('sign-in')
  })

  test('keeps digits', () => {
    expect(slugify('H1 Heading 2')).toBe('h1-heading-2')
  })

  test('treats non-ascii letters as separators', () => {
    expect(slugify('Café Crème')).toBe('caf-cr-me')
  })

  test('slugs all-separator or empty input to an empty string', () => {
    expect(slugify('   ')).toBe('')
    expect(slugify('—')).toBe('')
    expect(slugify('')).toBe('')
  })
})

describe('buildCatalog', () => {
  test('slugifies component and case ids while preserving display names', () => {
    const cat = buildCatalog([
      defineCases('Icon Button', { 'With Label': () => null }),
    ])
    expect(cat).toHaveLength(1)
    expect(cat[0].id).toBe('icon-button')
    expect(cat[0].name).toBe('Icon Button')
    expect(cat[0].cases[0].id).toBe('with-label')
    expect(cat[0].cases[0].name).toBe('With Label')
  })

  test('a simple (function) case carries null tweaks and no transitions', () => {
    const cat = buildCatalog([defineCases('Button', { Default: () => null })])
    expect(cat[0].cases[0].tweaks).toBeNull()
    expect(cat[0].cases[0].transitions).toEqual([])
  })

  test('a tweaked case exposes its declared tweak schema', () => {
    const tweaks = { label: tweak.text('Save') }
    const cat = buildCatalog([
      defineCases('Button', { Custom: { tweaks, render: () => null } }),
    ])
    expect(cat[0].cases[0].tweaks).toEqual(tweaks)
  })

  test('orders components by hierarchy level, then by name', () => {
    const cat = buildCatalog([
      defineCases('Zeta', { D: () => null }, { level: 'organism' }),
      defineCases('Alpha', { D: () => null }, { level: 'atom' }),
      defineCases('Beta', { D: () => null }, { level: 'atom' }),
    ])
    expect(cat.map((c) => c.name)).toEqual(['Alpha', 'Beta', 'Zeta'])
  })

  test('places unclassified (level-less) components last', () => {
    const cat = buildCatalog([
      defineCases('NoLevel', { D: () => null }),
      defineCases('Page', { D: () => null }, { level: 'page' }),
      defineCases('Atom', { D: () => null }, { level: 'atom' }),
    ])
    expect(cat.map((c) => c.name)).toEqual(['Atom', 'Page', 'NoLevel'])
  })

  test('preserves case insertion order within a component', () => {
    const cat = buildCatalog([
      defineCases('Button', {
        Third: () => null,
        First: () => null,
        Second: () => null,
      }),
    ])
    expect(cat[0].cases.map((c) => c.name)).toEqual([
      'Third',
      'First',
      'Second',
    ])
  })

  test('records a flow step’s outgoing transitions as slugified target ids', () => {
    const cat = buildCatalog([
      defineFlow('Sign In', {
        steps: {
          'Request Link': flowStep({
            transitions: ['Check Email'],
            render: () => null,
          }),
          'Check Email': flowStep({ render: () => null }),
        },
      }),
    ])
    expect(cat[0].isFlow).toBe(true)
    expect(cat[0].level).toBe('flow')
    expect(cat[0].cases[0].transitions).toEqual(['check-email'])
    expect(cat[0].cases[1].transitions).toEqual([])
  })

  test('sorts flows after every classified level (flow is the last level)', () => {
    const cat = buildCatalog([
      defineFlow('Onboard', { steps: { A: flowStep({ render: () => null }) } }),
      defineCases('Page', { D: () => null }, { level: 'page' }),
    ])
    expect(cat.map((c) => c.name)).toEqual(['Page', 'Onboard'])
  })
})

describe('findCase', () => {
  const modules: CaseModule[] = [
    defineCases('Icon Button', { 'With Label': () => null }),
    defineFlow('Sign In', {
      steps: { 'Request Link': flowStep({ render: () => null }) },
    }),
  ]

  test('resolves a component+case slug to original names and the case', () => {
    const hit = findCase(modules, 'icon-button', 'with-label')
    expect(hit).not.toBeNull()
    expect(hit?.module.component).toBe('Icon Button')
    expect(hit?.caseName).toBe('With Label')
    expect(typeof hit?.case).toBe('function')
  })

  test('resolves a flow step by its slug', () => {
    const hit = findCase(modules, 'sign-in', 'request-link')
    expect(hit?.caseName).toBe('Request Link')
  })

  test('returns null for an unknown component', () => {
    expect(findCase(modules, 'nope', 'with-label')).toBeNull()
  })

  test('returns null for an unknown case within a known component', () => {
    expect(findCase(modules, 'icon-button', 'nope')).toBeNull()
  })
})
