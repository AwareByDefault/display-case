import { mkdir, rm } from 'node:fs/promises'
import { basename, join, relative, resolve } from 'node:path'
import { slugify } from '../core/catalog'
import {
  cacheDir,
  codegenCaseRenderEntry,
  codegenCaseSsrEntry,
  codegenPrimerEntry,
  codegenSsrPrimerEntry,
  discoverCaseFiles,
  loadModules,
  resolveConfig,
} from '../core/discovery'
import type { DisplayCaseConfig } from '../index'
import type { PublishBuildRequest } from '../server/build-case'
import { spawnBuildWorker } from '../server/build-runner'
import { getManifest } from '../server/server'

/**
 * Build a self-contained, hostable showcase: production-bundled assets
 * (minified, content-hashed, no dev injects) plus a frozen manifest, styles, and
 * the SSR renderers, written to an output directory that a thin production server
 * (`prod-server.ts`) serves — or, with `static: true`, a crawl writes complete
 * HTML files that need no running server. None of the dev machinery (watcher,
 * live-reload, on-demand a11y, dev endpoints) is carried into the build.
 */

const HERE = resolve(import.meta.dir, '..')
const BROWSER_ENTRY = join(HERE, 'ui', 'browser-entry.tsx')
const CHROME_CSS = join(HERE, 'ui', 'chrome.css')
const DS_DIR = join(HERE, 'ui', 'design-system', 'tokens')
const DS_TOKEN_FILES = ['colors.css', 'typography.css', 'spacing.css']
const COMPONENTS_DIR = join(HERE, 'ui', 'design-system', 'components')
const PRIMER_CSS = join(HERE, 'ui', 'primer.css')

export interface PublishOptions {
  /** Output directory (default `<pkgDir>/dist-showcase`). */
  out?: string
  /** Base path for hosting under a subpath (e.g. `/showcase`). */
  base?: string
  /** Also write a fully-static (server-less) export. */
  static?: boolean
}

/** Public env (`BUN_PUBLIC_*`) inlined into the browser bundle, plus a forced
 *  production NODE_ENV so React builds in production mode. */
async function buildDefines(pkgDir: string): Promise<Record<string, string>> {
  const defines: Record<string, string> = {
    'process.env.NODE_ENV': '"production"',
  }
  for (const name of ['.env', '.env.local']) {
    const file = Bun.file(join(pkgDir, name))
    if (!(await file.exists())) continue
    for (const raw of (await file.text()).split('\n')) {
      const line = raw.trim()
      if (!line || line.startsWith('#')) continue
      const eq = line.indexOf('=')
      if (eq === -1) continue
      const key = line
        .slice(0, eq)
        .replace(/^export\s+/, '')
        .trim()
      if (!key.startsWith('BUN_PUBLIC_')) continue
      let value = line.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      defines[`process.env.${key}`] = JSON.stringify(value)
    }
  }
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('BUN_PUBLIC_') && value !== undefined) {
      defines[`process.env.${key}`] = JSON.stringify(value)
    }
  }
  return defines
}

async function readDesignTokens(): Promise<string> {
  const parts = await Promise.all(
    DS_TOKEN_FILES.map((f) => Bun.file(join(DS_DIR, f)).text()),
  )
  return parts.join('\n')
}

// The Vitrine's own chrome stylesheet — chrome.css + every design-system
// component's co-located CSS + the primer chrome's CSS, read and concatenated in
// path-sorted order. Mirrors server.ts; the published documents inline it so the
// chrome paints before scripts (the components no longer inject at runtime).
async function readVitrineCss(): Promise<string> {
  const componentFiles: string[] = []
  for await (const f of new Bun.Glob('**/*.css').scan({
    cwd: COMPONENTS_DIR,
    absolute: true,
  })) {
    componentFiles.push(f)
  }
  componentFiles.sort()
  const parts = await Promise.all(
    [CHROME_CSS, ...componentFiles, PRIMER_CSS].map((f) => Bun.file(f).text()),
  )
  return parts.join('\n')
}

async function readGlobalCss(
  pkgDir: string,
  config: DisplayCaseConfig,
): Promise<string> {
  const parts: string[] = []
  for (const rel of config.globalStyles ?? []) {
    const abs = resolve(pkgDir, rel)
    if (await Bun.file(abs).exists()) parts.push(await Bun.file(abs).text())
  }
  return parts.join('\n')
}

/** Map the chrome bundle's entry-point output path back to its logical name.
 *  (The per-component render bundles are matched separately, by their single
 *  entry-point output.) */
function entryName(path: string): 'browser' | 'primer' | null {
  const b = basename(path)
  if (b.startsWith('browser-entry')) return 'browser'
  if (b.startsWith('primer-entry')) return 'primer'
  return null
}

/**
 * Build one publish surface in a fresh child process — never `Bun.build` in this
 * long-lived publish process (the bundler-heap segfault precondition the segfault
 * reports identified). A child that dies on a signal (a native bundler crash) is
 * contained and attributed to the surface, so publish fails with a clear message
 * and a non-zero exit instead of inheriting the native panic. Returns the
 * entry-point outputs so the caller maps content-hashed basenames to asset URLs.
 */
async function runPublishBuild(
  surface: string,
  req: PublishBuildRequest,
): Promise<{ path: string; kind: string }[]> {
  const outcome = await spawnBuildWorker(['publish', JSON.stringify(req)])
  if (!outcome.ok) {
    if (outcome.crashed) {
      throw new Error(
        `Display Case publish: bundling ${surface} crashed the bundler ` +
          `(${outcome.error}). Split that case's imports — e.g. avoid importing a ` +
          `whole barrel (an entire icon set); import only the parts the case uses.`,
      )
    }
    throw new Error(
      `Display Case publish: failed to build ${surface}:\n${outcome.error ?? 'unknown error'}`,
    )
  }
  return outcome.outputs ?? []
}

export interface BuildDescriptor {
  title: string
  base: string
  a11y: false
  hasPrimer: boolean
  /** Content-hashed, base-prefixed entry URLs. `render` is per component
   *  (componentId → bundle URL) — the catalog is split, never one render entry. */
  assets: { browser: string; render: Record<string, string>; primer: string }
  tokensCss: string
  globalCss: string
  vitrineCss: string
}

export async function publish(
  pkgDir: string,
  opts: PublishOptions = {},
): Promise<{ out: string; descriptor: BuildDescriptor }> {
  const out = resolve(opts.out ?? join(pkgDir, 'dist-showcase'))
  const base = (opts.base ?? '').replace(/\/+$/, '')
  const { config, configPath } = await resolveConfig(pkgDir)

  await rm(out, { recursive: true, force: true })
  await mkdir(join(out, 'assets'), { recursive: true })
  await mkdir(join(out, 'server'), { recursive: true })

  const files = await discoverCaseFiles(pkgDir, config)
  const primerConfigured = !!config.primer
  const primerSrc = primerConfigured
    ? resolve(pkgDir, config.primer as string)
    : null
  const hasPrimer = !!primerSrc && (await Bun.file(primerSrc).exists())

  // Each component is one case file; build each into its own bundle so the
  // catalog is never bundled as a single module graph — the precondition for the
  // Bun-bundler crash on large showcases (see the per-case-on-demand-bundling
  // change). The catalog id is `slugify(component)`, matching the manifest.
  const { modules } = await loadModules(files)
  const components = modules.map((m) => ({
    file: m.file,
    id: slugify(m.module.component),
  }))

  const primerEntry = hasPrimer
    ? await codegenPrimerEntry(pkgDir, config.primer as string)
    : null
  const ssrPrimerEntry = hasPrimer
    ? await codegenSsrPrimerEntry(pkgDir, config.primer as string, configPath)
    : null

  const defines = await buildDefines(pkgDir)
  const assets = {
    browser: '',
    render: {} as Record<string, string>,
    primer: '',
  }
  const Hashed = {
    entry: '[name]-[hash].[ext]',
    chunk: '[name]-[hash].[ext]',
    asset: '[name]-[hash].[ext]',
  }

  // 1) Chrome bundle (the browse shell + optional primer) — carries no case
  // modules, so a small graph. Minified, content-hashed, production React.
  // pinReact keeps the render runtime and consumer components on one React copy.
  const chromeEntries = [BROWSER_ENTRY]
  if (primerEntry) chromeEntries.push(primerEntry)
  const chromeOut = await runPublishBuild('the browse chrome', {
    pkgDir,
    entrypoints: chromeEntries,
    outdir: join(out, 'assets'),
    target: 'browser',
    minify: true,
    naming: Hashed,
    define: defines,
    pinReact: true,
  })
  for (const o of chromeOut) {
    const name = entryName(o.path)
    if (name) assets[name] = `${base}/assets/${basename(o.path)}`
  }

  // 2) Per-component browser render bundles — one isolated build each (a bounded,
  // single-component graph), content-hashed as `render-case-<id>-<hash>.js`. Run
  // through the bounded worker pool so a large catalog publishes concurrently
  // without ever holding the whole catalog as one graph.
  await Promise.all(
    components.map(async (c) => {
      const entry = await codegenCaseRenderEntry(
        pkgDir,
        c.file,
        configPath,
        c.id,
      )
      const outs = await runPublishBuild(
        `component "${c.id}" (${relative(pkgDir, c.file)})`,
        {
          pkgDir,
          entrypoints: [entry],
          outdir: join(out, 'assets'),
          target: 'browser',
          minify: true,
          naming: Hashed,
          define: defines,
          pinReact: true,
        },
      )
      const ep = outs.find((o) => o.kind === 'entry-point')
      if (ep) assets.render[c.id] = `${base}/assets/${basename(ep.path)}`
    }),
  )

  // 3) SSR renderers for the production server: built once (no watching), imported
  // by `prod-server`. React stays external here (unlike the browser bundle and
  // the dev server's in-process SSR, which pin React to the consumer copy): a
  // published build deploys with its own `bun install`, so the prod process has a
  // single React already. Leaving it external keeps `prod-server`'s own chrome
  // renderer (`ssr-shell`, which needs `react-dom/server` at runtime regardless)
  // and these bundled case renderers on that one copy — bundling React here would
  // instead put a second copy in the prod process for no benefit. The dual-React
  // hazard pinReact addresses comes from a temp/global *tool* install resolving a
  // different React than the consumer's components; a clean deploy has neither.
  // Each component is its own SSR bundle (`ssr-case-<id>.js`), built separately so
  // — like the browser side — no single pass holds the whole catalog.
  const ssrExternal = [
    'react',
    'react-dom',
    'react-dom/server',
    'react/jsx-runtime',
    'react/jsx-dev-runtime',
  ]
  const ssrBuilds: Promise<unknown>[] = []
  if (ssrPrimerEntry) {
    ssrBuilds.push(
      runPublishBuild('the primer renderer', {
        pkgDir,
        entrypoints: [ssrPrimerEntry],
        outdir: join(out, 'server'),
        target: 'bun',
        minify: false,
        naming: { entry: '[name].[ext]', chunk: '[name]-[hash].[ext]' },
        define: defines,
        external: ssrExternal,
        pinReact: false,
      }),
    )
  }
  for (const c of components) {
    ssrBuilds.push(
      (async () => {
        const entry = await codegenCaseSsrEntry(
          pkgDir,
          c.file,
          configPath,
          c.id,
          0,
        )
        await runPublishBuild(
          `the renderer for component "${c.id}" (${relative(pkgDir, c.file)})`,
          {
            pkgDir,
            entrypoints: [entry],
            outdir: join(out, 'server'),
            target: 'bun',
            minify: false,
            // Fixed name (no hash) so `prod-server` resolves it by component id.
            naming: {
              entry: `ssr-case-${c.id}.[ext]`,
              chunk: '[name]-[hash].[ext]',
            },
            define: defines,
            external: ssrExternal,
            pinReact: false,
          },
        )
      })(),
    )
  }
  await Promise.all(ssrBuilds)

  const manifest = await getManifest(pkgDir)
  const descriptor: BuildDescriptor = {
    title: config.title,
    base,
    a11y: false,
    hasPrimer,
    assets,
    tokensCss: await readDesignTokens(),
    globalCss: await readGlobalCss(pkgDir, config),
    vitrineCss: await readVitrineCss(),
  }

  await Bun.write(
    join(out, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  )
  await Bun.write(
    join(out, 'dc-build.json'),
    `${JSON.stringify(descriptor, null, 2)}\n`,
  )

  // A standalone start script + run recipe, so the build deploys like any service.
  await Bun.write(
    join(out, 'server.ts'),
    `// AUTO-GENERATED by display-case publish — do not edit.\n` +
      `import { startProdServer } from 'display-case/prod-server'\n` +
      `await startProdServer(import.meta.dir, { port: Number(process.env.PORT) || 3000 })\n`,
  )
  await Bun.write(
    join(out, 'package.json'),
    `${JSON.stringify(
      {
        name: 'display-case-showcase',
        private: true,
        type: 'module',
        scripts: { start: 'bun server.ts' },
        dependencies: {
          'display-case': 'latest',
          react: '^19',
          'react-dom': '^19',
        },
      },
      null,
      2,
    )}\n`,
  )
  await Bun.write(
    join(out, 'Dockerfile'),
    [
      'FROM oven/bun:1 AS base',
      'WORKDIR /app',
      'COPY . .',
      'RUN bun install --production',
      'ENV PORT=3000',
      'EXPOSE 3000',
      `HEALTHCHECK CMD bun -e "await fetch('http://localhost:3000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"`,
      'CMD ["bun", "server.ts"]',
      '',
    ].join('\n'),
  )

  // Drop the gitignored codegen leftovers out of the published tree's cache.
  void cacheDir

  if (opts.static) {
    const { writeStaticExport } = await import('../server/prod-server')
    await writeStaticExport(out)
  }

  return { out, descriptor }
}
