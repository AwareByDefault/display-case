import { afterEach, describe, expect, test } from 'bun:test'
import { rm } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import type { DisplayCaseConfig } from '../index'
import { makeTempDir, writeFiles } from '../testing/test-helpers'
import {
  baselineDir,
  cacheDir,
  codegenCaseRenderEntry,
  codegenCaseSsrEntry,
  codegenPrimerEntry,
  discoverCaseFiles,
  loadModules,
  resolveConfig,
} from './discovery'

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

const cfg = (over: Partial<DisplayCaseConfig> = {}): DisplayCaseConfig => ({
  title: 'T',
  roots: ['**/*.case.tsx'],
  ...over,
})

describe('resolveConfig', () => {
  test('imports the default-exported config and returns its path', async () => {
    const dir = await setup({
      'display-case.config.ts': `export default { title: 'T', roots: ['x'] }\n`,
    })
    const { config, configPath } = await resolveConfig(dir)
    expect(config.title).toBe('T')
    expect(configPath.endsWith('display-case.config.ts')).toBe(true)
  })

  test('throws when no config file is present', async () => {
    const dir = await setup({})
    expect(resolveConfig(dir)).rejects.toThrow(/No Display Case config/)
  })

  test('throws when the config file has no default export', async () => {
    const dir = await setup({
      'display-case.config.ts': `export const notDefault = { title: 'T', roots: [] }\n`,
    })
    expect(resolveConfig(dir)).rejects.toThrow(/default-export/)
  })
})

describe('discoverCaseFiles', () => {
  test('resolves globs to sorted absolute paths', async () => {
    const dir = await setup({
      'a/Beta.case.tsx': 'export default {}\n',
      'a/Alpha.case.tsx': 'export default {}\n',
      'b/Gamma.case.tsx': 'export default {}\n',
    })
    const files = await discoverCaseFiles(dir, cfg())
    expect(files.every(isAbsolute)).toBe(true)
    expect(files.map((f) => f.slice(dir.length + 1))).toEqual([
      'a/Alpha.case.tsx',
      'a/Beta.case.tsx',
      'b/Gamma.case.tsx',
    ])
  })

  test('skips node_modules and dedups across overlapping globs', async () => {
    const dir = await setup({
      'Button.case.tsx': 'export default {}\n',
      'node_modules/pkg/Ignored.case.tsx': 'export default {}\n',
    })
    const files = await discoverCaseFiles(
      dir,
      cfg({ roots: ['**/*.case.tsx', '**/*.case.tsx'] }),
    )
    expect(files.map((f) => f.slice(dir.length + 1))).toEqual([
      'Button.case.tsx',
    ])
  })
})

describe('loadModules', () => {
  test('imports a valid case module', async () => {
    const dir = await setup({
      'Button.case.tsx': `export default { component: 'Button', cases: {}, isFlow: false }\n`,
    })
    const file = join(dir, 'Button.case.tsx')
    const { modules, errors } = await loadModules([file])
    expect(errors).toEqual([])
    expect(modules).toHaveLength(1)
    expect(modules[0]!.module.component).toBe('Button')
    expect(modules[0]!.file).toBe(file)
  })

  test('records a file with no default export as an error', async () => {
    const dir = await setup({ 'Bad.case.tsx': `export const nope = 1\n` })
    const file = join(dir, 'Bad.case.tsx')
    const { modules, errors } = await loadModules([file])
    expect(modules).toEqual([])
    expect(errors).toHaveLength(1)
    expect(errors[0]!.file).toBe(file)
    expect(errors[0]!.error).toMatch(/no valid default export/)
  })

  test('records a default export whose component is not a string', async () => {
    const dir = await setup({
      'Bad.case.tsx': `export default { cases: {}, isFlow: false }\n`,
    })
    const { modules, errors } = await loadModules([join(dir, 'Bad.case.tsx')])
    expect(modules).toEqual([])
    expect(errors).toHaveLength(1)
  })

  test('captures a throwing import and still loads the rest', async () => {
    const dir = await setup({
      'Throws.case.tsx': `throw new Error('boom')\n`,
      'Good.case.tsx': `export default { component: 'Good', cases: {}, isFlow: false }\n`,
    })
    const { modules, errors } = await loadModules([
      join(dir, 'Throws.case.tsx'),
      join(dir, 'Good.case.tsx'),
    ])
    expect(modules.map((m) => m.module.component)).toEqual(['Good'])
    expect(errors).toHaveLength(1)
    expect(errors[0]!.error).toMatch(/boom/)
  })
})

describe('cacheDir / baselineDir', () => {
  test('cacheDir is the .display-case dir under the package', () => {
    expect(cacheDir('/pkg')).toBe('/pkg/.display-case')
  })

  test('baselineDir defaults to the cache baselines dir', () => {
    expect(baselineDir('/pkg', cfg())).toBe('/pkg/.display-case/baselines')
  })

  test('baselineDir joins a relative override to the package', () => {
    expect(baselineDir('/pkg', cfg({ baselineDir: 'snaps' }))).toBe(
      '/pkg/snaps',
    )
  })

  test('baselineDir honors an absolute override verbatim', () => {
    expect(baselineDir('/pkg', cfg({ baselineDir: '/abs/snaps' }))).toBe(
      '/abs/snaps',
    )
  })
})

describe('codegen entries', () => {
  test('codegenCaseRenderEntry imports exactly one case and mounts only it', async () => {
    const dir = await setup({})
    const file = join(dir, 'a/Button.case.tsx')
    const configPath = join(dir, 'display-case.config.ts')
    const entry = await codegenCaseRenderEntry(dir, file, configPath, 'button')
    expect(entry).toBe(join(cacheDir(dir), 'render-case-button.tsx'))
    const src = await Bun.file(entry).text()
    expect(src).toContain('AUTO-GENERATED')
    expect(src).toContain('import m0 from')
    // Exactly one case module — never a second import (the whole point: no
    // all-cases graph in a single bundler pass).
    expect(src).not.toContain('import m1 from')
    expect(src).toContain('mountRender([')
    expect(src).toContain(`sourcePath: ${JSON.stringify('a/Button.case.tsx')}`)
  })

  test('codegenCaseSsrEntry imports one case and exports its renderer, with a fresh per-seq name', async () => {
    const dir = await setup({})
    const file = join(dir, 'a/Button.case.tsx')
    const configPath = join(dir, 'display-case.config.ts')
    const entry = await codegenCaseSsrEntry(dir, file, configPath, 'button', 3)
    expect(entry).toBe(join(cacheDir(dir), 'ssr-case-button-3.tsx'))
    const src = await Bun.file(entry).text()
    expect(src).toContain('import m0 from')
    expect(src).not.toContain('import m1 from')
    expect(src).toContain('export const renderCaseToHtml = makeCaseRenderer([')
  })

  test('codegenPrimerEntry imports the MDX document and mounts the primer', async () => {
    const dir = await setup({})
    const entry = await codegenPrimerEntry(dir, 'docs/primer.mdx')
    expect(entry).toBe(join(cacheDir(dir), 'primer-entry.tsx'))
    const src = await Bun.file(entry).text()
    expect(src).toContain('AUTO-GENERATED')
    expect(src).toContain('import MDXContent from')
    expect(src).toContain('primer.mdx')
    expect(src).toContain('mountPrimer(MDXContent)')
  })
})
