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
/** Two components importing `markdown-to-jsx`, which the config declares `share`. */
const SHARED_FIXTURE = resolve(
  import.meta.dir,
  '..',
  '..',
  'e2e/fixtures/consumer-shared',
)
/** The same two importers WITHOUT `share`, so the library inlines into both. */
const DUP_FIXTURE = resolve(
  import.meta.dir,
  '..',
  '..',
  'e2e/fixtures/consumer-dup',
)

describe('publish: artifacts', () => {
  let out: string
  let descriptor: BuildDescriptor

  beforeAll(async () => {
    out = await makeTempDir()
    ;({ descriptor } = await publish(FIXTURE, { out }))
  })
  afterAll(() => rm(out, { recursive: true, force: true }))

  test('emits content-hashed browser + per-component render bundles', async () => {
    const assets = await readdir(join(out, 'assets'))
    expect(assets.some((f) => /^browser-entry-.+\.js$/.test(f))).toBe(true)
    // Each component is its own bundle, never a single all-cases render entry.
    expect(assets.some((f) => /^render-case-.+-.+\.js$/.test(f))).toBe(true)
    expect(assets.some((f) => /^render-entry-.+\.js$/.test(f))).toBe(false)
  })

  test('React is shipped once as shared vendor bundles, not inlined per component', async () => {
    const assets = await readdir(join(out, 'assets'))
    // One content-hashed vendor entry per shared specifier (React's four by default),
    // built in one `splitting` pass so the reconciler dedupes into a shared chunk.
    const vendors = assets.filter((f) => /^vendor-.+\.js$/.test(f))
    expect(vendors.length).toBeGreaterThanOrEqual(4)
    // The importmap maps every externalized React specifier to a vendor bundle URL.
    for (const spec of [
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-runtime',
    ]) {
      expect(descriptor.assets.importmap[spec]).toMatch(
        /^\/assets\/vendor-.+\.js$/,
      )
    }
    // React's runtime lands in the vendor bundles (the reconciler's `createRoot` is
    // re-exported by the react-dom/client entry; its impl lives in the shared chunk).
    const vendorTexts = await Promise.all(
      vendors.map((f) => Bun.file(join(out, 'assets', f)).text()),
    )
    expect(vendorTexts.some((t) => t.includes('createRoot'))).toBe(true)
    // Regression guard against re-inlining: a per-component render bundle imports
    // React as external bare specifiers (resolved by the importmap) rather than
    // bundling its own copy — so dropping the externalization would fail here.
    const renderFile = assets.find((f) => /^render-case-.+-.+\.js$/.test(f))
    const renderText = await Bun.file(
      join(out, 'assets', renderFile as string),
    ).text()
    expect(renderText).toMatch(/from\s*"react/)
  })

  test('descriptor: production, a11y disabled, base-prefixed assets', () => {
    expect(descriptor.title).toBe('Plain Consumer')
    expect(descriptor.a11y).toBe(false)
    expect(descriptor.base).toBe('')
    expect(descriptor.assets.browser).toMatch(
      /^\/assets\/browser-entry-.+\.js$/,
    )
    // `render` is a per-component map; every entry is a hashed per-component bundle.
    const renderUrls = Object.values(descriptor.assets.render)
    expect(renderUrls.length).toBeGreaterThan(0)
    expect(
      renderUrls.every((u) => /^\/assets\/render-case-.+-.+\.js$/.test(u)),
    ).toBe(true)
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

  test('per-component SSR renderers are built for the production server', async () => {
    const server = await readdir(join(out, 'server'))
    // One SSR bundle per component (`ssr-case-<id>.js`); no all-cases ssr-entry.
    expect(server.some((f) => /^ssr-case-.+\.js$/.test(f))).toBe(true)
    expect(server.includes('ssr-entry.js')).toBe(false)
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
    const c = manifest.components[0]!
    const cs = c.cases[0]!
    const r = await fetch(`${baseUrl}/render/${c.id}/${cs.id}`)
    expect(r.status).toBe(200)
    const html = await r.text()
    expect(html).toContain('data-ssr="1"')
    // References this component's own bundle (the catalog is split per component).
    expect(html).toContain(descriptor.assets.render[c.id]!)
    // Chrome-free: the shell's title chrome is absent from the isolated doc.
    expect(html).not.toContain('Plain Consumer')
  })

  test('the shell and render documents carry the React importmap to the vendor bundle', async () => {
    const c = manifest.components[0]!
    const mapping = `"react":"${descriptor.assets.importmap.react}"`
    for (const path of ['/', `/render/${c.id}/${c.cases[0]!.id}`]) {
      const html = await (await fetch(`${baseUrl}${path}`)).text()
      // The importmap resolves the externalized bare specifiers to the one shared
      // bundle; without it the externalized bundles can't find React in the browser.
      expect(html).toContain('<script type="importmap">')
      expect(html).toContain(mapping)
    }
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
    // The importmap is plain markup, so React still resolves with no server.
    expect(html).toContain('<script type="importmap">')
    expect(html).toContain(`"react":"${descriptor.assets.importmap.react}"`)
  })

  test('writes a complete per-case render document', async () => {
    const c = manifest.components[0]!
    const cs = c.cases[0]!
    const file = join(out, 'render', c.id, cs.id, 'index.html')
    expect(await Bun.file(file).exists()).toBe(true)
    expect(await Bun.file(file).text()).toContain('data-ssr="1"')
  })
})

// Crash containment: inject a build worker that dies on a signal (mimicking the
// native Bun bundler segfault). Publish must reject with an attributed diagnostic
// instead of the publish process inheriting the native panic — and this test
// process must survive to make the assertion.
describe('publish: build-worker crash containment', () => {
  test('a bundler crash fails publish with an attributed error, not a panic', async () => {
    const out = await makeRepoTempDir()
    const stub = join(REPO, '.tmp', 'publish-crash-worker.ts')
    await Bun.write(stub, 'process.kill(process.pid, "SIGKILL")\n')
    process.env.DISPLAY_CASE_BUILD_WORKER = stub
    try {
      await expect(publish(FIXTURE, { out })).rejects.toThrow(
        /crashed the bundler/,
      )
    } finally {
      delete process.env.DISPLAY_CASE_BUILD_WORKER
      await rm(stub, { force: true })
      await rm(out, { recursive: true, force: true })
    }
  }, 30_000)
})

// Phase 2: a non-React library declared in `config.share` is delivered once, exactly
// like React — generalizing the vendor + importmap mechanism beyond the rendering
// runtime. Proves the introspection codegen and the externalization work for an
// arbitrary (CJS-shaped) library, and that a published shared library is added to the
// deployed package.json so its SSR renderers resolve it at runtime.
describe('publish: author-declared shared libraries', () => {
  let out: string
  let descriptor: BuildDescriptor
  let logs: string[]

  beforeAll(async () => {
    out = await makeTempDir()
    logs = []
    const realLog = console.log
    console.log = (...args: unknown[]) => {
      logs.push(args.join(' '))
    }
    try {
      ;({ descriptor } = await publish(SHARED_FIXTURE, { out }))
    } finally {
      console.log = realLog
    }
  })
  afterAll(() => rm(out, { recursive: true, force: true }))

  test('a declared library is shipped once and externalized from each component', async () => {
    const assets = await readdir(join(out, 'assets'))
    // A content-hashed vendor bundle for the declared library exists…
    expect(assets.some((f) => /^vendor-markdown-to-jsx-.+\.js$/.test(f))).toBe(
      true,
    )
    // …and the importmap resolves the bare specifier to it.
    expect(descriptor.assets.importmap['markdown-to-jsx']).toMatch(
      /^\/assets\/vendor-markdown-to-jsx-.+\.js$/,
    )
    // Each per-component bundle imports it as an external bare specifier (the
    // re-inlining guard) rather than bundling its own copy.
    const renderFiles = assets.filter((f) => /^render-case-.+-.+\.js$/.test(f))
    expect(renderFiles.length).toBeGreaterThanOrEqual(2)
    for (const f of renderFiles) {
      const t = await Bun.file(join(out, 'assets', f)).text()
      expect(t).toMatch(/from\s*"markdown-to-jsx"/)
    }
  })

  test('the published package.json lists the declared (published) library', async () => {
    const pkg = (await Bun.file(join(out, 'package.json')).json()) as {
      dependencies: Record<string, string>
    }
    expect(pkg.dependencies['markdown-to-jsx']).toBeDefined()
  })

  test('an undeclared subpath of a shared library inlines, not leak past the importmap', async () => {
    // The primer bundles `markdown-to-jsx` via an absolute path (the mdx plugin); its
    // internals import the `markdown-to-jsx/entities` subpath. Only the bare
    // `markdown-to-jsx` is shared/importmapped, so the subpath MUST be inlined — Bun's
    // prefix `external` would instead leave it a bare specifier the browser can't
    // resolve (caught as a real hydration error in a headless load). Exact-match
    // externalization keeps the subpath inlined. Guard every browser bundle.
    const assets = await readdir(join(out, 'assets'))
    const browserBundles = assets.filter(
      (f) => f.endsWith('.js') && !f.startsWith('vendor-'),
    )
    for (const f of browserBundles) {
      const t = await Bun.file(join(out, 'assets', f)).text()
      expect(t).not.toMatch(/from\s*"markdown-to-jsx\/entities"/)
    }
  })

  test('a shared library is excluded from the duplicate report', () => {
    // It is external (never an input), so the advisory never flags it.
    expect(logs.join('\n')).not.toContain('markdown-to-jsx —')
  })
})

// Phase 3: the advisory report names a library inlined across more than one component
// (a candidate for `share`), without changing the output or failing the build.
describe('publish: duplicate-runtime reporting', () => {
  test('reports a library inlined into more than one component', async () => {
    const out = await makeTempDir()
    const logs: string[] = []
    const realLog = console.log
    console.log = (...args: unknown[]) => {
      logs.push(args.join(' '))
    }
    try {
      await publish(DUP_FIXTURE, { out })
    } finally {
      console.log = realLog
      await rm(out, { recursive: true, force: true })
    }
    const report = logs.join('\n')
    expect(report).toContain('add to `share` to deliver once')
    expect(report).toMatch(/markdown-to-jsx — in 2 components/)
  })
})
