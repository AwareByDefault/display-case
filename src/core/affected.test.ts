import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { makeTempDir, writeFiles } from '../testing/test-helpers'
import { affectedComponents, importClosure } from './affected'

describe('importClosure', () => {
  let dir: string
  beforeAll(async () => {
    dir = await makeTempDir()
    await writeFiles(dir, {
      // Button: case → component → styles.css; styles.css → tokens.css.
      'Button.case.tsx':
        "import { Button } from './Button'\nexport default Button",
      'Button.tsx': "import './styles.css'\nimport { tk } from './util'",
      'styles.css': "@import './tokens.css';\n.b { color: red }",
      'tokens.css': ':root { --x: 1 }',
      'util.ts': "import React from 'react'\nexport const tk = 1",
      // Unrelated island the Button does not import.
      'Other.tsx': 'export const Other = 1',
    })
  })
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  test('follows relative JS and CSS imports transitively', async () => {
    const closure = await importClosure([join(dir, 'Button.case.tsx')])
    expect(closure.has(resolve(dir, 'Button.case.tsx'))).toBe(true)
    expect(closure.has(resolve(dir, 'Button.tsx'))).toBe(true)
    expect(closure.has(resolve(dir, 'styles.css'))).toBe(true)
    expect(closure.has(resolve(dir, 'tokens.css'))).toBe(true)
    expect(closure.has(resolve(dir, 'util.ts'))).toBe(true)
  })

  test('does not pull in unrelated files or bare specifiers', async () => {
    const closure = await importClosure([join(dir, 'Button.case.tsx')])
    expect(closure.has(resolve(dir, 'Other.tsx'))).toBe(false)
    // `react` is a bare specifier — not traced, so nothing resolves for it.
    for (const f of closure) expect(f.includes('node_modules')).toBe(false)
  })

  test('a missing entry contributes only itself', async () => {
    const ghost = join(dir, 'Nope.case.tsx')
    const closure = await importClosure([ghost])
    expect([...closure]).toEqual([resolve(ghost)])
  })
})

describe('affectedComponents', () => {
  let dir: string
  let components: { id: string; caseFile: string }[]
  beforeAll(async () => {
    dir = await makeTempDir()
    await writeFiles(dir, {
      'Button.case.tsx': "import './Button'",
      'Button.tsx': "import './button.css'",
      'button.css': '.b {}',
      'Card.case.tsx': "import './Card'",
      'Card.tsx': "import { tk } from './shared'",
      'shared.ts': 'export const tk = 1',
    })
    components = [
      { id: 'button', caseFile: resolve(dir, 'Button.case.tsx') },
      { id: 'card', caseFile: resolve(dir, 'Card.case.tsx') },
    ]
  })
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  test('a changed leaf affects only the component that imports it', async () => {
    const affected = await affectedComponents(components, [
      join(dir, 'button.css'),
    ])
    expect([...affected]).toEqual(['button'])
  })

  test('a shared dependency affects every importer', async () => {
    const affected = await affectedComponents(components, [
      join(dir, 'shared.ts'),
    ])
    expect([...affected]).toEqual(['card'])
  })

  test('a changed case file affects its own component', async () => {
    const affected = await affectedComponents(components, [
      join(dir, 'Card.case.tsx'),
    ])
    expect([...affected]).toEqual(['card'])
  })

  test('an unrelated change affects nothing', async () => {
    const affected = await affectedComponents(components, [
      join(dir, 'README.md'),
    ])
    expect(affected.size).toBe(0)
  })
})
