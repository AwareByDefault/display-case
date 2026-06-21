import { afterEach, describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { runInit, runUninstall } from './init'
import { makeTempDir, writeFiles } from './test-helpers'

/**
 * End-to-end exercise of the scaffolder against a throwaway repo. A `.git`
 * marker makes the temp dir its own repo root so `findRepoRoot` stops there and
 * every artifact lands inside the sandbox.
 */

const dirs: string[] = []
const opts = { agent: 'claude', json: false }

const makeRepo = async (extra: Record<string, string> = {}) => {
  const dir = await makeTempDir()
  dirs.push(dir)
  await writeFiles(dir, { '.git/HEAD': 'ref: refs/heads/main\n', ...extra })
  return dir
}

afterEach(async () => {
  while (dirs.length)
    await rm(dirs.pop() as string, { recursive: true, force: true })
})

describe('runInit / runUninstall', () => {
  test('a dry run plans changes without writing anything', async () => {
    const dir = await makeRepo()
    const res = await runInit(dir, { ...opts, dryRun: true })
    expect(res.command).toBe('init')
    expect(existsSync(join(dir, '.claude/launch.json'))).toBe(false)
    expect(existsSync(join(dir, 'AGENTS.md'))).toBe(false)
    const launch = res.items.find((i) => i.artifact.endsWith('launch.json'))
    expect(launch?.action).toBe('created')
  })

  test('init writes the launch config and the instructions pointer', async () => {
    const dir = await makeRepo()
    await runInit(dir, { ...opts, dryRun: false })
    expect(existsSync(join(dir, '.claude/launch.json'))).toBe(true)
    const agents = await Bun.file(join(dir, 'AGENTS.md')).text()
    expect(agents).toContain('## Display Case (for agents)')
    expect(agents).toContain('display-case:agent-guide:start')
  })

  test('re-running init is idempotent (the second run skips everything)', async () => {
    const dir = await makeRepo()
    await runInit(dir, { ...opts, dryRun: false })
    const again = await runInit(dir, { ...opts, dryRun: false })
    expect(again.items.every((i) => i.action === 'skipped')).toBe(true)
  })

  test('init merges into an existing launch.json without clobbering entries', async () => {
    const dir = await makeRepo({
      '.claude/launch.json': `${JSON.stringify(
        { version: '0.0.1', configurations: [{ name: 'other', port: 9 }] },
        null,
        2,
      )}\n`,
    })
    await runInit(dir, { ...opts, dryRun: false })
    const launch = JSON.parse(
      await Bun.file(join(dir, '.claude/launch.json')).text(),
    )
    const names = (launch.configurations as { name: string }[]).map(
      (c) => c.name,
    )
    expect(names).toContain('other')
    expect(names).toContain('display-case')
  })

  test('init appends to an existing AGENTS.md, preserving prior content', async () => {
    const dir = await makeRepo({ 'AGENTS.md': '# Project\n' })
    await runInit(dir, { ...opts, dryRun: false })
    const agents = await Bun.file(join(dir, 'AGENTS.md')).text()
    expect(agents).toContain('# Project')
    expect(agents).toContain('## Display Case (for agents)')
  })

  test('uninstall removes exactly what init wrote and is idempotent', async () => {
    const dir = await makeRepo()
    await runInit(dir, { ...opts, dryRun: false })

    const out = await runUninstall(dir, { ...opts, dryRun: false })
    expect(out.command).toBe('uninstall')

    const launch = JSON.parse(
      await Bun.file(join(dir, '.claude/launch.json')).text(),
    )
    const entry = (launch.configurations as { name: string }[]).find(
      (c) => c.name === 'display-case',
    )
    expect(entry).toBeUndefined()

    const agents = await Bun.file(join(dir, 'AGENTS.md')).text()
    expect(agents).not.toContain('display-case:agent-guide:start')

    const again = await runUninstall(dir, { ...opts, dryRun: false })
    expect(again.items.every((i) => i.action === 'skipped')).toBe(true)
  })

  test('uninstall preserves an unrelated launch entry', async () => {
    const dir = await makeRepo({
      '.claude/launch.json': `${JSON.stringify(
        { version: '0.0.1', configurations: [{ name: 'other', port: 9 }] },
        null,
        2,
      )}\n`,
    })
    await runInit(dir, { ...opts, dryRun: false })
    await runUninstall(dir, { ...opts, dryRun: false })
    const launch = JSON.parse(
      await Bun.file(join(dir, '.claude/launch.json')).text(),
    )
    const names = (launch.configurations as { name: string }[]).map(
      (c) => c.name,
    )
    expect(names).toEqual(['other'])
  })
})
