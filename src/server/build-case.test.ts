import { afterAll, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { writeFiles } from '../testing/test-helpers'
import { buildCaseBundles } from './build-case'

// A temp showcase INSIDE the repo: pinReact resolves the consumer React by
// walking up to the repo's node_modules, which a /tmp dir has none of (mirrors
// publish.test's makeRepoTempDir). Gitignored via `.tmp/`.
const REPO = resolve(import.meta.dir, '..', '..')
const dirs: string[] = []
async function repoTemp(): Promise<string> {
  const base = join(REPO, '.tmp')
  await mkdir(base, { recursive: true })
  const d = await mkdtemp(join(base, 'build-case-'))
  dirs.push(d)
  return d
}
afterAll(async () => {
  for (const d of dirs) await rm(d, { recursive: true, force: true })
})

const CONFIG = `export default { title: 'T', roots: ['*.case.tsx'] }\n`
const GOOD = `export default { component: 'Good', isFlow: false, cases: { Default: () => null } }\n`
// Statically imports a module that does not exist — a genuine *bundle* failure
// (the bundler can't resolve it), not just an eval error.
const BAD = `import './does-not-exist'\nexport default { component: 'Bad', isFlow: false, cases: { Default: () => null } }\n`

describe('buildCaseBundles', () => {
  test('builds one component to disk and reports its module graph', async () => {
    const dir = await repoTemp()
    await writeFiles(dir, {
      'display-case.config.ts': CONFIG,
      'Good.case.tsx': GOOD,
    })
    const r = await buildCaseBundles({
      pkgDir: dir,
      file: join(dir, 'Good.case.tsx'),
      configPath: join(dir, 'display-case.config.ts'),
      componentId: 'good',
      seq: 1,
    })
    expect(r.ok).toBe(true)
    expect(r.inputs.length).toBeGreaterThan(0)
    expect(
      await Bun.file(
        join(dir, '.display-case', 'dist', 'render-case-good.js'),
      ).exists(),
    ).toBe(true)
    expect(
      await Bun.file(
        join(dir, '.display-case', 'ssr', 'ssr-case-good-1.js'),
      ).exists(),
    ).toBe(true)
  })

  test('a component that cannot bundle returns ok:false with the error', async () => {
    const dir = await repoTemp()
    await writeFiles(dir, {
      'display-case.config.ts': CONFIG,
      'Bad.case.tsx': BAD,
    })
    const r = await buildCaseBundles({
      pkgDir: dir,
      file: join(dir, 'Bad.case.tsx'),
      configPath: join(dir, 'display-case.config.ts'),
      componentId: 'bad',
      seq: 1,
    })
    expect(r.ok).toBe(false)
    expect(r.error).toBeTruthy()
  })
})

// The worker process is the crash-isolation boundary: the server spawns it and
// reads its exit + JSON; a worker that dies on a signal (a native bundler crash)
// is contained and attributed instead of taking the server down.
describe('build worker (spawned)', () => {
  const Script = join(import.meta.dir, 'build-case.ts')
  const run = async (args: string[]) => {
    const proc = Bun.spawn(['bun', Script, ...args], {
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const [out, code] = await Promise.all([
      new Response(proc.stdout).text(),
      proc.exited,
    ])
    return { out, code }
  }
  const cfg = (dir: string) => join(dir, 'display-case.config.ts')

  test('case kind exits 0 + {ok:true} for a buildable component', async () => {
    const dir = await repoTemp()
    await writeFiles(dir, {
      'display-case.config.ts': CONFIG,
      'Good.case.tsx': GOOD,
    })
    const { out, code } = await run([
      'case',
      dir,
      join(dir, 'Good.case.tsx'),
      cfg(dir),
      'good',
      '1',
    ])
    expect(code).toBe(0)
    expect(JSON.parse(out).ok).toBe(true)
  })

  test('case kind exits non-zero + {ok:false} when it cannot bundle', async () => {
    const dir = await repoTemp()
    await writeFiles(dir, {
      'display-case.config.ts': CONFIG,
      'Bad.case.tsx': BAD,
    })
    const { out, code } = await run([
      'case',
      dir,
      join(dir, 'Bad.case.tsx'),
      cfg(dir),
      'bad',
      '1',
    ])
    expect(code).not.toBe(0)
    expect(JSON.parse(out).ok).toBe(false)
  })

  test('shell kind exits 0 + {ok:true}', async () => {
    const dir = await repoTemp()
    await writeFiles(dir, { 'display-case.config.ts': CONFIG })
    const { out, code } = await run(['shell', dir, cfg(dir), '', '1'])
    expect(code).toBe(0)
    expect(JSON.parse(out).ok).toBe(true)
  })

  test('an unknown build kind exits 2', async () => {
    const { code } = await run(['bogus'])
    expect(code).toBe(2)
  })
})
