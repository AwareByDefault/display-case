import { afterEach, describe, expect, test } from 'bun:test'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { makeTempDir, writeFiles } from '../testing/test-helpers'
import { baselinePathFor, legacyBaselinePath } from './check'

/**
 * The visual phase reads a baseline from the substrate-keyed path, falling back
 * to the pre-substrate flat layout when the keyed one is absent. That fallback
 * is what stops this change from invalidating every committed baseline at once,
 * so it is tested against real files rather than only at the path-helper level.
 */

const dirs: string[] = []
afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })),
  )
})

const substrate = { id: 'dom' }
const target = { componentId: 'button', caseId: 'primary', variantKey: 'dark' }

/** Mirrors the runner's read choice: keyed if present, else legacy if present. */
async function readFrom(baselines: string): Promise<string | null> {
  const keyed = baselinePathFor(baselines, substrate, target, 'png')
  if (await Bun.file(keyed).exists()) return keyed
  const legacy = legacyBaselinePath(baselines, target)
  return (await Bun.file(legacy).exists()) ? legacy : null
}

describe('baseline resolution', () => {
  test('reads the keyed path when it exists', async () => {
    const dir = await makeTempDir()
    dirs.push(dir)
    await writeFiles(dir, { 'dom/button/primary.dark.png': 'keyed' })
    expect(await readFrom(dir)).toBe(join(dir, 'dom/button/primary.dark.png'))
  })

  test('falls back to the pre-substrate flat path when the keyed one is absent', async () => {
    // A showcase with a committed baseline directory must keep comparing
    // against its existing recordings rather than reporting every case as new.
    const dir = await makeTempDir()
    dirs.push(dir)
    await writeFiles(dir, { 'button/primary.dark.png': 'legacy' })
    expect(await readFrom(dir)).toBe(join(dir, 'button/primary.dark.png'))
  })

  test('prefers the keyed path when both exist', async () => {
    // Once re-recorded, the keyed baseline is the live one — the stale flat
    // file must not shadow it.
    const dir = await makeTempDir()
    dirs.push(dir)
    await writeFiles(dir, {
      'dom/button/primary.dark.png': 'keyed',
      'button/primary.dark.png': 'legacy',
    })
    expect(await readFrom(dir)).toBe(join(dir, 'dom/button/primary.dark.png'))
  })

  test('reports no baseline when neither layout has one', async () => {
    const dir = await makeTempDir()
    dirs.push(dir)
    expect(await readFrom(dir)).toBeNull()
  })

  test('another substrate does not read the DOM substrate’s baselines', async () => {
    // The substrate segment exists precisely to stop this.
    const dir = await makeTempDir()
    dirs.push(dir)
    await writeFiles(dir, { 'dom/button/primary.dark.png': 'keyed' })
    const term = baselinePathFor(dir, { id: 'terminal' }, target, 'txt')
    expect(await Bun.file(term).exists()).toBe(false)
    expect(term).toBe(join(dir, 'terminal/button/primary.dark.txt'))
  })
})
