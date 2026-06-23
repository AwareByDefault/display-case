import { describe, expect, test } from 'bun:test'
import type { CaseModule, DisplayCaseConfig } from '../index'
import {
  buildGroupTree,
  deriveGroupFromFolder,
  isSurfaceLevel,
  makeGroupResolver,
} from './groups'

const ROOTS = ['src/app/**/*.case.tsx']

function mod(over: Partial<CaseModule>): CaseModule {
  return {
    component: 'Pricing',
    cases: {},
    isFlow: false,
    level: 'page',
    ...over,
  }
}

function config(over: Partial<DisplayCaseConfig> = {}): DisplayCaseConfig {
  return { title: 'T', roots: ROOTS, ...over }
}

describe('isSurfaceLevel', () => {
  test('only page and flow are surfaces', () => {
    expect(isSurfaceLevel('page')).toBe(true)
    expect(isSurfaceLevel('flow')).toBe(true)
    expect(isSurfaceLevel('atom')).toBe(false)
    expect(isSurfaceLevel('template')).toBe(false)
    expect(isSurfaceLevel(null)).toBe(false)
  })
})

describe('deriveGroupFromFolder', () => {
  test('derives title-cased segments relative to the root, dropping the filename', () => {
    expect(
      deriveGroupFromFolder(
        'src/app/marketing/pricing/Pricing.case.tsx',
        ROOTS,
      ),
    ).toEqual(['Marketing', 'Pricing'])
  })

  test('strips route-group parentheses and leading underscores', () => {
    expect(
      deriveGroupFromFolder('src/app/(marketing)/_promo/Sale.case.tsx', ROOTS),
    ).toEqual(['Marketing', 'Promo'])
  })

  test('title-cases dashed segments', () => {
    expect(
      deriveGroupFromFolder(
        'src/app/settings/payment-methods/X.case.tsx',
        ROOTS,
      ),
    ).toEqual(['Settings', 'Payment Methods'])
  })

  test('a file directly in the root yields no group', () => {
    expect(deriveGroupFromFolder('src/app/Home.case.tsx', ROOTS)).toEqual([])
  })

  test('a path outside every root yields no group', () => {
    expect(deriveGroupFromFolder('other/place/X.case.tsx', ROOTS)).toEqual([])
  })
})

describe('makeGroupResolver — precedence', () => {
  test('non-surfaces never get a group', () => {
    const resolve = makeGroupResolver(config())
    expect(
      resolve(
        mod({
          level: 'atom',
          group: ['Should', 'Ignore'],
          sourcePath: 'src/app/marketing/Button.case.tsx',
        }),
      ),
    ).toEqual([])
  })

  test('explicit group wins over folder', () => {
    const resolve = makeGroupResolver(config())
    expect(
      resolve(
        mod({
          group: ['App', 'Settings'],
          sourcePath: 'src/app/marketing/pricing/Pricing.case.tsx',
        }),
      ),
    ).toEqual(['App', 'Settings'])
  })

  test('folder derivation applies when no explicit group', () => {
    const resolve = makeGroupResolver(config())
    expect(
      resolve(
        mod({ sourcePath: 'src/app/marketing/pricing/Pricing.case.tsx' }),
      ),
    ).toEqual(['Marketing', 'Pricing'])
  })

  test('folder derivation is disablable, falling through to config', () => {
    const resolve = makeGroupResolver(
      config({
        nav: {
          deriveFromFolder: false,
          surface: [{ area: 'admin', group: 'Admin' }],
        },
      }),
    )
    expect(
      resolve(
        mod({
          area: 'admin',
          sourcePath: 'src/app/marketing/pricing/Pricing.case.tsx',
        }),
      ),
    ).toEqual(['Admin'])
  })

  test('config surface rule assigns when explicit + folder yield nothing', () => {
    const resolve = makeGroupResolver(
      config({
        nav: { surface: [{ id: 'pricing', group: 'Marketing/Plans' }] },
      }),
    )
    expect(resolve(mod({ component: 'Pricing' }))).toEqual([
      'Marketing',
      'Plans',
    ])
  })

  test('falls back to the default (empty) group', () => {
    const resolve = makeGroupResolver(config())
    expect(resolve(mod({ component: 'Pricing' }))).toEqual([])
  })
})

describe('buildGroupTree', () => {
  const components = [
    { group: ['Marketing', 'Pricing'] },
    { group: ['Marketing', 'About'] },
    { group: ['App', 'Settings', 'Billing'] },
    { group: [] }, // default group contributes no node
  ]

  test('nests segments into a tree', () => {
    const tree = buildGroupTree(components, config())
    const marketing = tree.find((g) => g.label === 'Marketing')
    expect(marketing?.children.map((c) => c.label)).toEqual([
      'Pricing',
      'About',
    ])
    const app = tree.find((g) => g.label === 'App')
    expect(app?.children[0].children[0].path).toEqual([
      'App',
      'Settings',
      'Billing',
    ])
  })

  test('honors configured order, labels, and collapsed', () => {
    const tree = buildGroupTree(
      components,
      config({
        nav: {
          groups: {
            order: ['App', 'Marketing'],
            labels: { app: 'Signed-in app' },
            collapsed: ['marketing'],
          },
        },
      }),
    )
    expect(tree.map((g) => g.label)).toEqual(['Signed-in app', 'Marketing'])
    expect(tree.find((g) => g.path[0] === 'Marketing')?.collapsed).toBe(true)
  })
})
