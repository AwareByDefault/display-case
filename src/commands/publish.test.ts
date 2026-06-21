import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readdir, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { Manifest } from '../core/manifest'
import { startProdServer } from '../server/prod-server'
import { makeTempDir } from '../testing/test-helpers'
import { type BuildDescriptor, publish } from './publish'

/**
 * A build dir anchored INSIDE the repo. The published server/static SSR bundle
 * keeps `react`/`react-dom` external (resolved at runtime), so when we import or
 * serve it in-process the build must sit where module resolution walks up to the
 * repo's `node_modules` — a `/tmp` dir has none. (A real deploy installs
 * `node_modules` alongside the build; this reproduces that.) Gitignored via
 * `.tmp/`.
 */
const REPO = resolve(import.meta.dir, '..', '..')
async function makeRepoTempDir(): Promise<string> {
  const base = join(REPO, '.tmp')
  await mkdir(base, { recursive: true })
  return mkdtemp(join(base, 'publish-'))
}

/**
 * Coverage for the publish / deploy path — previously untested. Two levels,
 * both Docker-free:
 *   1. the published *artifacts* (bundle, frozen manifest, generated
 *      server/Dockerfile, no dev machinery), and
 *   2. the *served* build booted in-process via `startProdServer`, plus the
 *      `--static` export.
 * The containerized deploy path (a real `docker build`) is Docker-gated in
 * `test/publish-container.test.ts`.
 *
 * Published against a minimal fixture for speed and determinism.
 */
const FIXTURE = resolve(
  import.meta.dir,
  '..',
  '..',
  'e2e/fixtures/consumer-plain',
)

describe('publish: artifacts', () => {
  let out: string
  let descriptor: BuildDescriptor

  beforeAll(async () => {
    out = await makeTempDir()
    ;({ descriptor } = await publish(FIXTURE, { out }))
  })
  afterAll(() => rm(out, { recursive: true, force: true }))

  test('emits content-hashed browser + render bundles', async () => {
    const assets = await readdir(join(out, 'assets'))
    expect(assets.some((f) => /^browser-entry-.+\.js$/.test(f))).toBe(true)
    expect(assets.some((f) => /^render-entry-.+\.js$/.test(f))).toBe(true)
  })

  test('descriptor: production, a11y disabled, base-prefixed assets', () => {
    expect(descriptor.title).toBe('Plain Consumer')
    expect(descriptor.a11y).toBe(false)
    expect(descriptor.base).toBe('')
    expect(descriptor.assets.browser).toMatch(
      /^\/assets\/browser-entry-.+\.js$/,
    )
    expect(descriptor.assets.render).toMatch(/^\/assets\/render-entry-.+\.js$/)
  })

  test('frozen manifest + build descriptor written to disk', async () => {
    const manifest = (await Bun.file(
      join(out, 'manifest.json'),
    ).json()) as Manifest
    expect(Array.isArray(manifest.components)).toBe(true)
    expect(manifest.components.length).toBeGreaterThan(0)
    const dc = (await Bun.file(
      join(out, 'dc-build.json'),
    ).json()) as BuildDescriptor
    expect(dc.a11y).toBe(false)
  })

  test('SSR renderers are built for the production server', async () => {
    expect(await Bun.file(join(out, 'server', 'ssr-entry.js')).exists()).toBe(
      true,
    )
  })

  test('generated server.ts uses the prod-server, carries no dev machinery', async () => {
    const s = await Bun.file(join(out, 'server.ts')).text()
    expect(s).toContain("from 'display-case/prod-server'")
    expect(s).toContain('AUTO-GENERATED')
    expect(s).not.toContain('__livereload')
  })

  test('generated package.json is a deployable service descriptor', async () => {
    const pkg = (await Bun.file(join(out, 'package.json')).json()) as {
      scripts: Record<string, string>
      dependencies: Record<string, string>
    }
    expect(pkg.scripts.start).toBe('bun server.ts')
    expect(pkg.dependencies['display-case']).toBeDefined()
    expect(pkg.dependencies.react).toBeDefined()
    expect(pkg.dependencies['react-dom']).toBeDefined()
  })

  test('generated Dockerfile builds a Bun service with a health check', async () => {
    const df = await Bun.file(join(out, 'Dockerfile')).text()
    expect(df).toContain('FROM oven/bun')
    expect(df).toContain('bun install --production')
    expect(df).toContain('/health')
    expect(df).toContain('CMD ["bun", "server.ts"]')
  })

  test('--base prefixes the hashed asset URLs for subpath hosting', async () => {
    const o2 = await makeTempDir()
    try {
      const { descriptor: d } = await publish(FIXTURE, {
        out: o2,
        base: '/showcase',
      })
      expect(d.base).toBe('/showcase')
      expect(d.assets.browser).toMatch(/^\/showcase\/assets\//)
    } finally {
      await rm(o2, { recursive: true, force: true })
    }
  })
})

describe('publish: the served build is a functional showcase', () => {
  let out: string
  let descriptor: BuildDescriptor
  let manifest: Manifest
  let server: Awaited<ReturnType<typeof startProdServer>>
  let baseUrl: string

  beforeAll(async () => {
    out = await makeRepoTempDir()
    ;({ descriptor } = await publish(FIXTURE, { out }))
    manifest = (await Bun.file(join(out, 'manifest.json')).json()) as Manifest
    server = await startProdServer(out, { port: 0 })
    baseUrl = `http://localhost:${server.port}`
  })
  afterAll(async () => {
    await server?.stop(true)
    await rm(out, { recursive: true, force: true })
  })

  test('GET /health returns ok', async () => {
    const r = await fetch(`${baseUrl}/health`)
    expect(r.status).toBe(200)
    expect(await r.text()).toBe('ok')
  })

  test('the shell is server-rendered, links hashed assets, and has no dev live-reload', async () => {
    const r = await fetch(`${baseUrl}/`)
    expect(r.status).toBe(200)
    const html = await r.text()
    expect(html).toContain('Plain Consumer') // title server-rendered
    expect(html).toContain('data-ssr="1"') // content present before scripts
    expect(html).toContain(descriptor.assets.browser) // hashed bundle linked
    expect(html).not.toContain('__livereload') // dev SSE stripped
    expect(html).not.toContain('EventSource')
    expect(r.headers.get('cache-control')).toContain('no-cache')
  })

  test('the isolated /render endpoint serves a chrome-free, pre-scripting document', async () => {
    const c = manifest.components[0]
    const cs = c.cases[0]
    const r = await fetch(`${baseUrl}/render/${c.id}/${cs.id}`)
    expect(r.status).toBe(200)
    const html = await r.text()
    expect(html).toContain('data-ssr="1"')
    expect(html).toContain(descriptor.assets.render)
    // Chrome-free: the shell's title chrome is absent from the isolated doc.
    expect(html).not.toContain('Plain Consumer')
  })

  test('hashed assets are served with immutable caching', async () => {
    const r = await fetch(`${baseUrl}${descriptor.assets.browser}`)
    expect(r.status).toBe(200)
    expect(r.headers.get('cache-control')).toContain('immutable')
  })
})

describe('publish: the static export needs no running server', () => {
  let out: string
  let descriptor: BuildDescriptor
  let manifest: Manifest

  beforeAll(async () => {
    out = await makeRepoTempDir()
    ;({ descriptor } = await publish(FIXTURE, { out, static: true }))
    manifest = (await Bun.file(join(out, 'manifest.json')).json()) as Manifest
  })
  afterAll(() => rm(out, { recursive: true, force: true }))

  test('writes a complete index.html with the shell pre-rendered', async () => {
    const html = await Bun.file(join(out, 'index.html')).text()
    expect(html).toContain('<!doctype html>')
    expect(html).toContain('Plain Consumer')
    expect(html).toContain(descriptor.assets.browser)
  })

  test('writes a complete per-case render document', async () => {
    const c = manifest.components[0]
    const cs = c.cases[0]
    const file = join(out, 'render', c.id, cs.id, 'index.html')
    expect(await Bun.file(file).exists()).toBe(true)
    expect(await Bun.file(file).text()).toContain('data-ssr="1"')
  })
})
