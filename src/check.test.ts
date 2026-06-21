import { afterEach, describe, expect, test } from 'bun:test'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { a11yDetailLines, runChecks } from './check'
import type { A11yViolation } from './index'
import { makeTempDir, writeFiles } from './test-helpers'

const CLI = join(import.meta.dir, 'cli.ts')

/**
 * `a11yDetailLines` turns a violation's per-node detail into the indented lines
 * the CLI prints — the colour pair / element that makes a finding fixable. It's
 * pure, so it's the one piece of the a11y output testable without a browser.
 */
describe('check: a11y detail formatting', () => {
  test('color-contrast node renders the measured pair and threshold', () => {
    const v: A11yViolation = {
      id: 'color-contrast',
      help: 'Elements must meet minimum color contrast ratio thresholds',
      nodes: 1,
      impact: 'serious',
      details: [
        {
          target: 'span.dcui-eyebrow',
          html: '<span class="dcui-eyebrow">Tweaks</span>',
          contrast: {
            foreground: '#8a8073',
            background: '#ffffff',
            ratio: 3.71,
            required: 4.5,
            fontSize: '12.0pt',
            fontWeight: '400',
          },
        },
      ],
    }
    expect(a11yDetailLines(v)).toEqual([
      '      ↳ span.dcui-eyebrow  #8a8073 on #ffffff = 3.71:1 (need 4.5:1)  [12.0pt 400]',
    ])
  })

  test('non-contrast node renders the element and first summary line', () => {
    const v: A11yViolation = {
      id: 'select-name',
      help: 'Select element must have an accessible name',
      nodes: 1,
      impact: 'critical',
      details: [
        {
          target: 'select.dcui-select-el',
          html: '<select class="dcui-select-el">',
          failureSummary: 'Fix any of the following:\n  Element has no name',
        },
      ],
    }
    expect(a11yDetailLines(v)).toEqual([
      '      ↳ select.dcui-select-el  Fix any of the following:',
    ])
  })

  test('caps the inline list and notes the remainder', () => {
    const details = Array.from({ length: 10 }, (_, i) => ({
      target: `x${i}`,
      html: '',
      contrast: {
        foreground: '#000',
        background: '#fff',
        ratio: 1,
        required: 4.5,
      },
    }))
    const lines = a11yDetailLines({
      id: 'color-contrast',
      help: 'h',
      nodes: 10,
      impact: 'serious',
      details,
    })
    expect(lines).toHaveLength(9)
    expect(lines.at(-1)).toBe('      ↳ … +2 more node(s)')
  })

  test('a violation with no detail yields no lines', () => {
    expect(
      a11yDetailLines({
        id: 'x',
        help: 'h',
        nodes: 1,
        impact: null,
      }),
    ).toEqual([])
  })
})

/**
 * The structure (and token) phases are static: `runChecks` must not start the
 * dev server for them, and the CLI must honor `check.defaultPhases`. These are
 * the only render-free assertions we can make without booting a browser, so the
 * a11y/visual phases are exercised by the e2e suite, not here.
 */
describe('check: structure phase wiring', () => {
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

  const AllRules = [
    'case-placard-coverage',
    'no-orphaned-placard-doc',
    'primer-present-and-used',
    'setup-present',
    'config-paths-exist',
    'levels-classified',
    'cases-load',
    'flow-transitions-resolve',
    'flow-multi-step',
    'unique-slugs',
    'tweak-defaults-valid',
    'atom-purity',
    'no-downward-dependency',
    'composes-lower-level',
    'level-fit',
  ]
  // A config that enables only the named rules (others disabled), so the static
  // run is deterministic and free of the noisy default-on rules.
  const cfg = (enabled: string[]) => {
    const rules = AllRules.map(
      (id) => `'${id}': ${enabled.includes(id) ? '{}' : 'false'}`,
    ).join(', ')
    return `export default { title:'F', roots:['**/*.case.tsx'], check:{ structure:{ rules:{ ${rules} } } } }\n`
  }
  const runStructure = (dir: string) =>
    runChecks(dir, {
      structure: true,
      tokens: false,
      a11y: false,
      visual: false,
      ssr: false,
      update: false,
    })

  test('structure-only run resolves without starting a server', async () => {
    const dir = await setup({
      'display-case.config.ts': cfg(['levels-classified']),
      'X.case.tsx': `export default { component:'X', cases:{}, isFlow:false, level:'atom' }\n`,
    })
    // No port is passed; a structure-only run must not need or start the server.
    expect(await runStructure(dir)).toBe(true)
  })

  test('structure-only run returns false on an error finding', async () => {
    const dir = await setup({
      'display-case.config.ts': cfg(['levels-classified']),
      // Unclassified (no level) ⇒ an error-severity finding.
      'X.case.tsx': `export default { component:'X', cases:{}, isFlow:false }\n`,
    })
    expect(await runStructure(dir)).toBe(false)
  })

  const cli = async (dir: string, args: string[]) => {
    const proc = Bun.spawn(['bun', CLI, 'check', dir, ...args], {
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const [out, err] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ])
    await proc.exited
    return out + err
  }

  test('defaultPhases opts a phase out of the bare run but not the explicit one', async () => {
    // Every phase opted out of the default run, so the bare `check` runs nothing
    // (and never boots a browser). X is unclassified ⇒ structure errors when run.
    const dir = await setup({
      'display-case.config.ts':
        `export default { title:'F', roots:['**/*.case.tsx'], ` +
        `check:{ defaultPhases:{ tokens:false, a11y:false, visual:false, structure:false } } }\n`,
      'X.case.tsx': `export default { component:'X', cases:{}, isFlow:false }\n`,
    })
    const bare = await cli(dir, [])
    expect(bare).not.toContain('structure ✗')
    const explicit = await cli(dir, ['--structure'])
    expect(explicit).toContain('structure ✗')
  })
})
