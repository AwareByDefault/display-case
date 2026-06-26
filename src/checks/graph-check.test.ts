import { afterAll, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { writeFiles } from '../testing/test-helpers'
import {
  analyzeComponentGraph,
  checkGraph,
  owningPackage,
  resolveGraphBudget,
} from './graph-check'

describe('owningPackage', () => {
  test('names the package after the last node_modules segment', () => {
    expect(owningPackage('/app/node_modules/react/index.js')).toBe('react')
  })

  test('honors an @scope/name', () => {
    expect(owningPackage('/app/node_modules/@phosphor/react/dist/i.js')).toBe(
      '@phosphor/react',
    )
  })

  test('uses the innermost (last) node_modules for nested installs', () => {
    expect(owningPackage('/app/node_modules/a/node_modules/b/index.js')).toBe(
      'b',
    )
  })

  test('first-party source belongs to no package', () => {
    expect(owningPackage('/app/src/Button.case.tsx')).toBeNull()
  })
})

describe('analyzeComponentGraph', () => {
  const budget = { modules: 1500, perPackage: 400 }
  const inputs = [
    '/app/src/Button.case.tsx',
    '/app/src/Button.tsx',
    '/app/node_modules/react/index.js',
    '/app/node_modules/react/jsx-runtime.js',
    '/app/node_modules/@scope/ui/a.js',
  ]

  test('counts the total graph and groups packages, descending', () => {
    const r = analyzeComponentGraph(inputs, budget)
    expect(r.total).toBe(5)
    expect(r.overBudget).toBe(false)
    expect(r.packages).toEqual([
      { name: 'react', count: 2 },
      { name: '@scope/ui', count: 1 },
    ])
    expect(r.barrels).toEqual([])
  })

  test('flags an over-total graph', () => {
    expect(
      analyzeComponentGraph(inputs, { modules: 2, perPackage: 400 }),
    ).toMatchObject({ total: 5, overBudget: true })
  })

  test('flags a barrel: a package over the per-package budget', () => {
    const r = analyzeComponentGraph(inputs, { modules: 1500, perPackage: 1 })
    expect(r.barrels).toEqual([
      { name: 'react', count: 2 },
      // @scope/ui has 1 module, which is not > 1, so it is not a barrel.
    ])
  })

  test('empty inputs are safe', () => {
    expect(analyzeComponentGraph([], budget)).toEqual({
      total: 0,
      overBudget: false,
      packages: [],
      barrels: [],
    })
  })
})

describe('resolveGraphBudget', () => {
  test('uses defaults when unset', () => {
    expect(resolveGraphBudget()).toEqual({ modules: 1500, perPackage: 400 })
  })

  test('merges a partial config over the defaults', () => {
    expect(resolveGraphBudget({ modules: 50 })).toEqual({
      modules: 50,
      perPackage: 400,
    })
  })
})

// Integration: build a real (small) component through the crash-contained worker
// and measure its graph. A temp showcase INSIDE the repo so pinReact resolves the
// consumer React from the repo's node_modules (a /tmp dir has none).
const REPO = resolve(import.meta.dir, '..', '..')
const dirs: string[] = []
async function repoTemp(): Promise<string> {
  const base = join(REPO, '.tmp')
  await mkdir(base, { recursive: true })
  const d = await mkdtemp(join(base, 'graph-check-'))
  dirs.push(d)
  return d
}
afterAll(async () => {
  for (const d of dirs) await rm(d, { recursive: true, force: true })
})

const GOOD = `export default { component: 'Good', isFlow: false, cases: { Default: () => null } }\n`

describe('checkGraph (integration)', () => {
  test('measures a component and stays within a generous budget', async () => {
    const dir = await repoTemp()
    await writeFiles(dir, {
      'display-case.config.ts': `export default { title: 'T', roots: ['*.case.tsx'] }\n`,
      'Good.case.tsx': GOOD,
    })
    const { measured, findings } = await checkGraph(dir)
    expect(measured).toHaveLength(1)
    expect(measured[0]!.componentId).toBe('good')
    expect(measured[0]!.total).toBeGreaterThan(0)
    expect(findings).toEqual([])
  }, 30_000)

  test('a tiny configured budget warns, and --strict escalates to an error', async () => {
    const dir = await repoTemp()
    await writeFiles(dir, {
      // modules:1 forces any real component over budget; perPackage huge ⇒ no barrel.
      'display-case.config.ts': `export default { title: 'T', roots: ['*.case.tsx'], check: { graphBudget: { modules: 1, perPackage: 100000 } } }\n`,
      'Good.case.tsx': GOOD,
    })
    const warned = await checkGraph(dir)
    expect(warned.findings).toHaveLength(1)
    expect(warned.findings[0]!.severity).toBe('warning')
    expect(warned.findings[0]!.message).toContain('over the budget')

    const strict = await checkGraph(dir, { strict: true })
    expect(strict.findings[0]!.severity).toBe('error')
  }, 30_000)
})
