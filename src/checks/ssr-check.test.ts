import { afterEach, describe, expect, test } from 'bun:test'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { makeTempDir, writeFiles } from '../testing/test-helpers'
import { checkSsr } from './ssr-check'

// Case fixtures import the real authoring helpers by absolute path so they load
// from a temp dir outside the workspace's module resolution.
const DC = join(import.meta.dir, '..', 'index.ts')
const caseFile = (body: string) =>
  `import { defineCases } from '${DC}'\nexport default ${body}\n`

const SUB = join(import.meta.dir, '..', 'substrate', 'dom.ts')

const CONFIG = `export default { title: 'F', roots: ['**/*.case.tsx'] }\n`

describe('checkSsr', () => {
  const dirs: string[] = []
  const setup = async (files: Record<string, string>) => {
    const dir = await makeTempDir()
    dirs.push(dir)
    await writeFiles(dir, { 'display-case.config.ts': CONFIG, ...files })
    return dir
  }
  afterEach(async () => {
    while (dirs.length)
      await rm(dirs.pop() as string, { recursive: true, force: true })
  })

  test('a case that renders purely passes', async () => {
    const dir = await setup({
      'Plain.case.tsx': caseFile(
        `defineCases('Plain', { Default: () => 'hi' }, { level: 'atom' })`,
      ),
    })
    const { findings, rendered, declared } = await checkSsr(dir)
    expect(findings).toHaveLength(0)
    expect(rendered).toBe(1)
    expect(declared).toBe(0)
  })

  test('a case that touches a browser API during render is flagged', async () => {
    const dir = await setup({
      'Widget.case.tsx': caseFile(
        `defineCases('Widget', { Win: () => String(window.innerWidth) }, { level: 'atom' })`,
      ),
    })
    const { findings } = await checkSsr(dir)
    expect(findings).toHaveLength(1)
    expect(findings[0]!.component).toBe('Widget')
    expect(findings[0]!.case).toBe('Win')
    expect(findings[0]!.error).toMatch(/window/)
    expect(findings[0]!.file).toMatch(/Widget\.case\.tsx$/)
  })

  // The complementary property — a browser API used in an *effect* or *handler*
  // (which never runs on the server) must NOT be flagged — is covered by the
  // dogfood `ssr` check passing: SelectMenu/TweaksPanel/RenderAddress all reach
  // for `window`/`getComputedStyle`/`navigator` inside effects and handlers, and
  // every dogfood case renders server-side cleanly. (It can't be unit-fixtured
  // here: a hook-using component needs a `react` import, which a temp-dir fixture
  // outside the workspace can't resolve.)

  test('a component declared browserOnly is skipped, not flagged', async () => {
    const dir = await setup({
      'Widget.case.tsx': caseFile(
        `defineCases('Widget', { Win: () => String(window.innerWidth) }, { level: 'atom', browserOnly: true })`,
      ),
    })
    const { findings, rendered, declared } = await checkSsr(dir)
    expect(findings).toHaveLength(0)
    expect(rendered).toBe(0)
    expect(declared).toBe(1)
  })

  test('a substrate-supplied safety phase replaces the default render', async () => {
    // The phase is the substrate's to define: a medium can fail in ways a
    // plain render never surfaces. A case that renders fine must still be
    // reported when the substrate's own safety check objects.
    const dir = await makeTempDir()
    dirs.push(dir)
    await writeFiles(dir, {
      'display-case.config.ts': [
        `import { domSubstrate } from '${SUB}'`,
        `const base = domSubstrate()`,
        `export default { title: 'F', roots: ['**/*.case.tsx'], substrate: {`,
        `  ...base,`,
        `  checks: { ...base.checks, safety: () => [{ componentId: 'plain', severity: 'error', message: 'too wide for 80 columns' }] },`,
        `} }`,
        ``,
      ].join('\n'),
      'Plain.case.tsx': caseFile(
        `defineCases('Plain', { Default: () => 'hi' }, { level: 'atom' })`,
      ),
    })
    const { findings, rendered } = await checkSsr(dir)
    expect(rendered).toBe(0)
    expect(findings).toHaveLength(1)
    expect(findings[0]!.error).toBe('too wide for 80 columns')
  })
})
