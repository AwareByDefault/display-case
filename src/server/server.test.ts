import { afterEach, describe, expect, test } from 'bun:test'
import { rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { makeTempDir, writeFiles } from '../testing/test-helpers'
import {
  classifyBuildResult,
  getManifest,
  type Invalidatable,
  shellErrorHtml,
  slugify,
  staleCaseIds,
  startDisplayCase,
} from './server'

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
    // Button (atom) → Components; Sign In (flow) → Exhibits; no primer.
    expect(m.modes).toEqual(['components', 'exhibits'])
    expect(m.landing).toBe('components')
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
    // A flow is a surface → its cases route under the /e/ (Exhibits) prefix.
    expect(flow.cases[0].browseUrl.startsWith('/e/sign-in/')).toBe(true)
  })

  test('offers the primer mode when a configured .mdx exists', async () => {
    const dir = await setup({
      'display-case.config.ts': `export default { title: 'P', roots: ['**/*.case.tsx'], primer: 'doc.mdx' }\n`,
      'doc.mdx': '# Hello\n',
      'Button.case.tsx': `export default { component: 'Button', isFlow: false, cases: { Default: () => null } }\n`,
    })
    const m = await getManifest(dir)
    expect(m.modes).toContain('primer')
    // Primer present and no landing override → land on it.
    expect(m.landing).toBe('primer')
  })

  test('lands on the configured mode when present, even with a primer', async () => {
    const dir = await setup({
      'display-case.config.ts': `export default { title: 'P', roots: ['**/*.case.tsx'], primer: 'doc.mdx', landing: 'components' }\n`,
      'doc.mdx': '# Hello\n',
      'Button.case.tsx': `export default { component: 'Button', isFlow: false, cases: { Default: () => null } }\n`,
    })
    const m = await getManifest(dir)
    expect(m.modes).toContain('primer')
    expect(m.landing).toBe('components')
  })

  test('omits the primer mode when the configured .mdx is missing', async () => {
    const dir = await setup({
      'display-case.config.ts': `export default { title: 'P', roots: ['**/*.case.tsx'], primer: 'missing.mdx' }\n`,
      'Button.case.tsx': `export default { component: 'Button', isFlow: false, cases: { Default: () => null } }\n`,
    })
    const m = await getManifest(dir)
    expect(m.modes).not.toContain('primer')
  })
})

describe('slugify (re-exported from the server entry)', () => {
  test('matches the catalog slugifier', () => {
    expect(slugify('Sign In')).toBe('sign-in')
  })
})

// Integration: the dev server prepares each component on demand rather than
// bundling the whole catalog at once. Booted against Display Case's own
// dogfooded showcase (dozens of components) — a single-graph build of that
// catalog is what crashes Bun's bundler at scale; this confirms the server
// starts and serves without ever building it as one graph.
describe('per-component on-demand bundling (integration)', () => {
  // The worktree/repo root: has display-case.config.ts and node_modules (pinReact
  // resolves the consumer React from here).
  const Repo = resolve(import.meta.dir, '..', '..')

  test('serves a large showcase, building each component only when first requested', async () => {
    const server = await startDisplayCase(Repo, { port: 0 })
    try {
      const base = String(server.url).replace(/\/$/, '')

      // The browsing surface and catalog are served even though the catalog is
      // large and no case bundle has been built yet (size-independent startup).
      expect((await fetch(`${base}/`)).ok).toBe(true)
      const manifest = (await (
        await fetch(`${base}/manifest.json`)
      ).json()) as {
        components: { id: string; cases: { id: string; renderUrl: string }[] }[]
      }
      expect(manifest.components.length).toBeGreaterThan(10)

      // A case builds on first request to its address and references that one
      // component's bundle — which is then served.
      const comp = manifest.components[0]
      const cs = comp.cases[0]
      const doc = await (await fetch(`${base}${cs.renderUrl}`)).text()
      expect(doc).toContain(`/dist/render-case-${comp.id}.js`)
      expect(doc).toContain('data-ssr="1"')
      expect(
        (await fetch(`${base}/dist/render-case-${comp.id}.js`)).status,
      ).toBe(200)

      // An unknown component does not crash the server — it serves a document and
      // every other case keeps working (failure is isolated, never fatal).
      expect((await fetch(`${base}/render/__no-such-component__/x`)).ok).toBe(
        true,
      )
      const other = manifest.components[1]
      const otherDoc = await (
        await fetch(`${base}${other.cases[0].renderUrl}`)
      ).text()
      expect(otherDoc).toContain(`/dist/render-case-${other.id}.js`)
    } finally {
      server.stop(true)
    }
  }, 60_000)
})

// The crash-containment logic: how the server interprets a build worker's exit.
describe('classifyBuildResult', () => {
  test('a clean {ok:true} JSON is a success', () => {
    const r = classifyBuildResult('{"ok":true,"inputs":["/a.ts"]}', 0, null)
    expect(r.ok).toBe(true)
    expect(r.inputs).toEqual(['/a.ts'])
  })

  test('an {ok:false} JSON is a logical build error, not a crash', () => {
    const r = classifyBuildResult(
      '{"ok":false,"inputs":[],"error":"boom"}',
      1,
      null,
    )
    expect(r.ok).toBe(false)
    expect(r.crashed).toBe(false)
    expect(r.error).toBe('boom')
  })

  test('a signal death (no JSON) is a bundler crash', () => {
    const r = classifyBuildResult('', null, 'SIGSEGV')
    expect(r.ok).toBe(false)
    expect(r.crashed).toBe(true)
    expect(r.error).toContain('crashed')
  })

  test('a non-zero exit with no JSON (e.g. bad args) is abnormal, not a crash', () => {
    const r = classifyBuildResult('', 2, null)
    expect(r.ok).toBe(false)
    expect(r.crashed).toBe(false)
    expect(r.error).toContain('code 2')
  })
})

describe('shellErrorHtml', () => {
  test('renders a self-contained diagnostic naming the error, no chrome bundle', () => {
    const html = shellErrorHtml(
      'the bundler crashed (killed by SIGSEGV)',
      false,
    )
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('could not build its browse chrome')
    expect(html).toContain('SIGSEGV')
    expect(html).not.toContain('/dist/browser-entry.js')
  })
})

// End-to-end crash containment: inject a worker that dies on a signal (mimicking a
// native bundler segfault). The server must keep running and serve a diagnostic
// rather than terminating with the native panic the report describes.
describe('build-worker crash containment (integration)', () => {
  const Repo = resolve(import.meta.dir, '..', '..')

  test('a build-worker crash keeps the server up and serves a diagnostic', async () => {
    const stub = join(Repo, '.tmp', 'crash-worker.ts')
    await Bun.write(stub, 'process.kill(process.pid, "SIGKILL")\n')
    process.env.DISPLAY_CASE_BUILD_WORKER = stub
    try {
      // The shell build is the crashing worker → rebuild() records shellError but
      // does not throw, so the server still binds.
      const server = await startDisplayCase(Repo, { port: 0 })
      try {
        const base = String(server.url).replace(/\/$/, '')
        const r = await fetch(`${base}/`)
        expect(r.status).toBe(500)
        expect(await r.text()).toContain('could not build its browse chrome')
        // Still alive after serving the diagnostic.
        expect((await fetch(`${base}/health`)).ok).toBe(true)
      } finally {
        server.stop(true)
      }
    } finally {
      delete process.env.DISPLAY_CASE_BUILD_WORKER
      await rm(stub, { force: true })
    }
  }, 60_000)
})

// Live reload: a watch rebuild must invalidate exactly the components whose
// module graph includes a changed file — so an edit is reflected (never stale)
// without forcing every other component to rebuild. Tested at the pure-function
// level (the OS file watcher that feeds it the paths is not deterministic enough
// to assert on under `bun test`).
describe('staleCaseIds (graph-aware invalidation)', () => {
  const ok = (...inputs: string[]): Invalidatable => ({
    ok: true,
    inputs: new Set(inputs),
  })
  // Two components: A imports a shared dep, B is independent.
  const cache = (): Map<string, Invalidatable> =>
    new Map<string, Invalidatable>([
      ['a', ok('/p/src/A.case.tsx', '/p/src/shared.ts')],
      ['b', ok('/p/src/B.case.tsx')],
    ])

  test('editing a case file invalidates only that component', () => {
    expect(staleCaseIds(cache(), ['/p/src/A.case.tsx'])).toEqual(new Set(['a']))
  })

  test('editing a shared (non-entry) dependency invalidates its dependents only', () => {
    // The shared file is in A's graph but not B's — only A is dropped.
    expect(staleCaseIds(cache(), ['/p/src/shared.ts'])).toEqual(new Set(['a']))
  })

  test('an unrelated change invalidates nothing', () => {
    expect(staleCaseIds(cache(), ['/p/src/other.ts'])).toEqual(new Set())
  })

  test('a failed entry is always invalidated (so a fix is retried)', () => {
    const c = cache()
    c.set('bad', { ok: false })
    expect(staleCaseIds(c, ['/p/src/other.ts'])).toEqual(new Set(['bad']))
  })

  test('no changed paths is a conservative fallback — invalidate everything', () => {
    expect(staleCaseIds(cache(), [])).toEqual(new Set(['a', 'b']))
  })
})
