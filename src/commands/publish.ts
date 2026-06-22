import { mkdir, rm } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import {
  cacheDir,
  codegenPrimerEntry,
  codegenRenderEntry,
  codegenSsrEntry,
  codegenSsrPrimerEntry,
  discoverCaseFiles,
  resolveConfig,
} from '../core/discovery'
import { mdxPlugin } from '../core/mdx-plugin'
import { pinReact } from '../core/pin-react'
import type { DisplayCaseConfig } from '../index'
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

/** Map a built entry-point's output path back to its logical name. */
function entryName(path: string): 'browser' | 'render' | 'primer' | null {
  const b = basename(path)
  if (b.startsWith('browser-entry')) return 'browser'
  if (b.startsWith('render-entry')) return 'render'
  if (b.startsWith('primer-entry')) return 'primer'
  return null
}

export interface BuildDescriptor {
  title: string
  base: string
  a11y: false
  hasPrimer: boolean
  /** Content-hashed, base-prefixed entry URLs. */
  assets: { browser: string; render: string; primer: string }
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

  // Codegen the same entries the dev server uses.
  const renderEntry = await codegenRenderEntry(pkgDir, files, configPath)
  const primerEntry = hasPrimer
    ? await codegenPrimerEntry(pkgDir, config.primer as string)
    : null
  const ssrEntry = await codegenSsrEntry(pkgDir, files, configPath)
  const ssrPrimerEntry = hasPrimer
    ? await codegenSsrPrimerEntry(pkgDir, config.primer as string, configPath)
    : null

  const defines = await buildDefines(pkgDir)

  // Browser bundle: minified, content-hashed, production React. pinReact keeps
  // Display Case's render runtime and the consumer's components on one React copy
  // (see pinReact for the dual-React bug it prevents).
  const browserEntries = [BROWSER_ENTRY, renderEntry]
  if (primerEntry) browserEntries.push(primerEntry)
  const browser = await Bun.build({
    entrypoints: browserEntries,
    outdir: join(out, 'assets'),
    target: 'browser',
    minify: true,
    sourcemap: 'none',
    plugins: [mdxPlugin(), pinReact(pkgDir)],
    define: defines,
    naming: {
      entry: '[name]-[hash].[ext]',
      chunk: '[name]-[hash].[ext]',
      asset: '[name]-[hash].[ext]',
    },
  })
  if (!browser.success) {
    for (const log of browser.logs) console.error(log)
    throw new Error('Display Case publish: browser bundle failed')
  }

  const assets = { browser: '', render: '', primer: '' }
  for (const o of browser.outputs) {
    if (o.kind !== 'entry-point') continue
    const name = entryName(o.path)
    if (name) assets[name] = `${base}/assets/${basename(o.path)}`
  }

  // SSR renderers for the production server: built once (no watching), imported
  // by `prod-server`. React stays external here (unlike the browser bundle and
  // the dev server's in-process SSR, which pin React to the consumer copy): a
  // published build deploys with its own `bun install`, so the prod process has a
  // single React already. Leaving it external keeps `prod-server`'s own chrome
  // renderer (`ssr-shell`, which needs `react-dom/server` at runtime regardless)
  // and these bundled case renderers on that one copy — bundling React here would
  // instead put a second copy in the prod process for no benefit. The dual-React
  // hazard pinReact addresses comes from a temp/global *tool* install resolving a
  // different React than the consumer's components; a clean deploy has neither.
  const ssrEntries = [ssrEntry]
  if (ssrPrimerEntry) ssrEntries.push(ssrPrimerEntry)
  const ssr = await Bun.build({
    entrypoints: ssrEntries,
    outdir: join(out, 'server'),
    target: 'bun',
    plugins: [mdxPlugin()],
    define: defines,
    external: [
      'react',
      'react-dom',
      'react-dom/server',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
    ],
    naming: { entry: '[name].[ext]', chunk: '[name]-[hash].[ext]' },
  })
  if (!ssr.success) {
    for (const log of ssr.logs) console.error(log)
    throw new Error('Display Case publish: SSR bundle failed')
  }

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
