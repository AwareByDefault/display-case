import { afterEach, describe, expect, test } from 'bun:test'
import { rm } from 'node:fs/promises'
import { getManifest, slugify } from './server'
import { makeTempDir, writeFiles } from './test-helpers'

const dirs: string[] = []
const setup = async (files: Record<string, string>) => {
  const dir = await makeTempDir()
  dirs.push(dir)
  await writeFiles(dir, files)
  return dir
}

afterEach(async () => {
  while (dirs.length)
    await rm(dirs.pop() as string, { recursive: true, force: true })
})

const BUTTON = `export default {
  component: 'Button',
  level: 'atom',
  isFlow: false,
  cases: {
    Default: () => null,
    Primary: { tweaks: { label: { kind: 'text', default: 'Save' } }, render: () => null },
  },
}
`

const SIGN_IN = `export default {
  component: 'Sign In',
  level: 'flow',
  isFlow: true,
  cases: {
    'Request Link': { transitions: ['Check Email'], render: () => null },
    'Check Email': { render: () => null },
  },
}
`

describe('getManifest', () => {
  test('builds an ordered manifest with URLs, tweaks, transitions, and placard docs', async () => {
    const dir = await setup({
      'display-case.config.ts': `export default { title: 'Fixtures', roots: ['**/*.case.tsx'] }\n`,
      'Button.case.tsx': BUTTON,
      'Button.placard.md': '# Button\n',
      'Sign-in.case.tsx': SIGN_IN,
    })
    const m = await getManifest(dir)

    expect(m.title).toBe('Fixtures')
    expect(m.primer).toBe(false)
    // No primer → the library is the only landing view.
    expect(m.landing).toBe('library')
    // atom sorts before flow
    expect(m.components.map((c) => c.name)).toEqual(['Button', 'Sign In'])

    const button = m.components[0]
    expect(button.id).toBe('button')
    expect(button.level).toBe('atom')
    expect(button.isFlow).toBe(false)
    expect(button.placardDoc).not.toBeNull()

    const primary = button.cases.find((c) => c.id === 'primary')
    expect(primary?.browseUrl).toBe('/c/button/primary')
    expect(primary?.renderUrl).toBe('/render/button/primary')
    expect(primary?.tweaks).toEqual({
      label: { kind: 'text', default: 'Save' },
    })

    const def = button.cases.find((c) => c.id === 'default')
    expect(def?.tweaks).toBeNull()

    const flow = m.components[1]
    expect(flow.isFlow).toBe(true)
    expect(flow.placardDoc).toBeNull()
    expect(flow.cases[0].transitions).toEqual(['check-email'])
  })

  test('flags primer true when a configured .mdx exists', async () => {
    const dir = await setup({
      'display-case.config.ts': `export default { title: 'P', roots: ['**/*.case.tsx'], primer: 'doc.mdx' }\n`,
      'doc.mdx': '# Hello\n',
      'Button.case.tsx': `export default { component: 'Button', isFlow: false, cases: { Default: () => null } }\n`,
    })
    const m = await getManifest(dir)
    expect(m.primer).toBe(true)
    // Primer present and not overridden → land on it.
    expect(m.landing).toBe('primer')
  })

  test('lands on the library when landing is cases, even with a primer', async () => {
    const dir = await setup({
      'display-case.config.ts': `export default { title: 'P', roots: ['**/*.case.tsx'], primer: 'doc.mdx', landing: 'cases' }\n`,
      'doc.mdx': '# Hello\n',
      'Button.case.tsx': `export default { component: 'Button', isFlow: false, cases: { Default: () => null } }\n`,
    })
    const m = await getManifest(dir)
    expect(m.primer).toBe(true)
    expect(m.landing).toBe('library')
  })

  test('leaves primer false when the configured .mdx is missing', async () => {
    const dir = await setup({
      'display-case.config.ts': `export default { title: 'P', roots: ['**/*.case.tsx'], primer: 'missing.mdx' }\n`,
      'Button.case.tsx': `export default { component: 'Button', isFlow: false, cases: { Default: () => null } }\n`,
    })
    const m = await getManifest(dir)
    expect(m.primer).toBe(false)
  })
})

describe('slugify (re-exported from the server entry)', () => {
  test('matches the catalog slugifier', () => {
    expect(slugify('Sign In')).toBe('sign-in')
  })
})
