import { mkdir, realpath, rm } from 'node:fs/promises'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
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
 * One library delivered **once** across the published surfaces instead of inlined
 * into each per-component bundle. The chrome and every per-component browser build
 * mark its `specifiers` external (bare imports), the bounded vendor build emits one
 * content-hashed bundle per specifier, and an importmap resolves each bare specifier
 * to its bundle (see `documents.ts`). React is always shared; an author adds more via
 * `config.share`.
 */
interface SharedLib {
  /** The package name — for grouping, SSR externals, and the generated
   *  `package.json` deps (`react`, `@emotion/react`, `@acme/design-tokens`). */
  package: string
  /** The bare specifiers a browser surface imports: the package plus any declared
   *  subpaths (`['react', 'react/jsx-runtime']`, `['@acme/icons/solid']`). */
  specifiers: string[]
  /**
   * `published` → the package is installed from a registry: keep it external on the
   * SSR renderers (the deploy `bun install`s it) and list it in the generated
   * `package.json`. `workspace` → it is defined within this repo and has no registry
   * coordinates: it is still shared on the *browser* side (vendor bundle + importmap),
   * but **bundled** into each SSR renderer (a private package can't be installed at
   * deploy time; duplicating it across SSR bundles is host disk, not client bytes).
   */
  origin: 'published' | 'workspace'
  /** Installed version (for the generated `package.json` range); null if unknown. */
  version: string | null
}

/** The package name a bare specifier belongs to (`react/jsx-runtime` → `react`,
 *  `@acme/icons/solid` → `@acme/icons`). */
function packageNameOf(spec: string): string {
  if (spec.startsWith('@')) return spec.split('/').slice(0, 2).join('/')
  return spec.split('/')[0] as string
}

/** The on-disk stem (no hash) for a specifier's generated vendor entry. The content
 *  hash is appended as `-<hash>.js` by Bun, and the hash never contains `-`, so the
 *  stem is recoverable from an output basename by stripping the final `-<hash>.ext`
 *  (see `specifierForOutput`). */
function vendorStem(spec: string): string {
  return `vendor-${spec.replace(/[^a-zA-Z0-9]+/g, '-')}`
}

/** Recover the bare specifier a content-hashed vendor entry-point output belongs to.
 *  `vendor-react-dom-client-a1b2c3.js` → stem `vendor-react-dom-client`. The hash
 *  token has no `-`, so stripping the trailing `-<token>.ext` is unambiguous even
 *  though `vendor-react` is a prefix of `vendor-react-dom`. */
function specifierForOutput(
  path: string,
  stemToSpec: Map<string, string>,
): string | null {
  const stem = basename(path).replace(/-[^-]+\.(js|css)$/, '')
  return stemToSpec.get(stem) ?? null
}

const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/
// JS keywords / reserved words can be export *names* but not `const` bindings, so a
// `export const <kw> = ns.<kw>` would be a syntax error — skip them (a surface that
// imports such a name keeps it inlined; vanishingly rare for shared runtime libs).
const RESERVED = new Set([
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'function',
  'if',
  'import',
  'in',
  'instanceof',
  'new',
  'null',
  'return',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'yield',
  'let',
  'static',
])

/**
 * Inspect a shared package's installed copy: its version, and whether it resolves
 * from a registry (`published`) or from within this repo (`workspace`). A workspace
 * package is typically symlinked into `node_modules`, so we follow the link with
 * `realpath` and check whether the *real* location is under a `node_modules`
 * directory — a published package's real files live there; a workspace package's
 * real files live in the repo source tree.
 */
async function packageInfo(
  pkg: string,
  pkgDir: string,
): Promise<{ version: string | null; origin: 'published' | 'workspace' }> {
  let entry: string
  try {
    entry = Bun.resolveSync(pkg, pkgDir)
  } catch {
    return { version: null, origin: 'published' }
  }
  let dir = dirname(entry)
  let version: string | null = null
  let root: string | null = null
  // Walk up to the package root (the dir whose package.json `name` is this package).
  while (true) {
    const pj = join(dir, 'package.json')
    if (await Bun.file(pj).exists()) {
      try {
        const json = (await Bun.file(pj).json()) as {
          name?: string
          version?: string
        }
        if (json.name === pkg) {
          version = json.version ?? null
          root = dir
          break
        }
      } catch {
        // not this package's manifest; keep walking
      }
    }
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  let origin: 'published' | 'workspace' = 'published'
  if (root) {
    try {
      origin = (await realpath(root)).split(sep).includes('node_modules')
        ? 'published'
        : 'workspace'
    } catch {
      // realpath can fail on odd layouts; default to published (the safe SSR-external
      // choice, and it only adds a package.json dep, which a deploy can satisfy).
    }
  }
  return { version, origin }
}

/** The consumer's declared version ranges (dev + peer + regular deps merged, regular
 *  winning) so the generated showcase package.json reuses the exact range the
 *  consumer tested with rather than inventing one. */
async function readConsumerRanges(
  pkgDir: string,
): Promise<Record<string, string>> {
  try {
    const pj = (await Bun.file(join(pkgDir, 'package.json')).json()) as {
      dependencies?: Record<string, string>
      peerDependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    return {
      ...pj.devDependencies,
      ...pj.peerDependencies,
      ...pj.dependencies,
    }
  } catch {
    return {}
  }
}

/**
 * Resolve the full shared-runtime set: React (always shared — the rendering runtime
 * every surface depends on) plus every library the author declared in `config.share`.
 * Declared entries are grouped by package (so `['@acme/icons/solid', '@acme/icons']`
 * is one library with two specifiers), resolved from the consumer package (worktree-
 * safe), and tagged `published`/`workspace`. A declared `react`/`react-dom` specifier
 * merges into the always-shared React entry rather than duplicating it.
 */
async function resolveSharedLibs(
  pkgDir: string,
  share: string[],
): Promise<SharedLib[]> {
  const byPackage = new Map<string, SharedLib>()
  const ensure = async (pkg: string): Promise<SharedLib> => {
    let lib = byPackage.get(pkg)
    if (!lib) {
      const { version, origin } = await packageInfo(pkg, pkgDir)
      lib = { package: pkg, specifiers: [], origin, version }
      byPackage.set(pkg, lib)
    }
    return lib
  }
  const add = async (spec: string) => {
    const lib = await ensure(packageNameOf(spec))
    if (!lib.specifiers.includes(spec)) lib.specifiers.push(spec)
  }
  // React first, so its bundles sort ahead deterministically.
  for (const spec of ['react', 'react/jsx-runtime']) await add(spec)
  for (const spec of ['react-dom', 'react-dom/client']) await add(spec)
  for (const spec of share) await add(spec)
  return [...byPackage.values()]
}

/**
 * Codegen one shared **vendor** entry per specifier. Each re-exports the consumer's
 * installed module so the chrome and every per-component bundle can import it as an
 * external bare specifier (resolved by the importmap to that specifier's one
 * content-hashed bundle) rather than inlining its own copy. All entries are built in
 * a single `splitting` `Bun.build` (see `publish`), so code common to several
 * specifiers (e.g. the React reconciler under `react-dom` and `react-dom/client`)
 * dedupes into one shared chunk.
 *
 * Why introspect-and-re-export rather than `export * from '<spec>'`: a CommonJS
 * module (React, and many libraries) under `export *` yields runtime property
 * *copies*, not the static ESM export bindings another module's
 * `import { useState } from 'react'` (left external, resolved here via the importmap)
 * needs at link time — those throw "Export … is not defined" in the browser. A
 * *named* `export { createRoot }` gives a static binding but lets the bundler
 * tree-shake impl it can't trace through the CJS boundary. The robust form, generated
 * per build from the *actually installed* exports (so it tracks the consumer's
 * version): `import * as ns from '<spec>'` (a namespace import retains the module's
 * whole impl — nothing tree-shaken) plus `export const x = ns.x` per export name (a
 * static binding), and `export default ns.default` when the module has a default.
 */
async function codegenVendorEntries(
  pkgDir: string,
  libs: SharedLib[],
): Promise<{ specifier: string; file: string; stem: string }[]> {
  const entries: { specifier: string; file: string; stem: string }[] = []
  for (const lib of libs) {
    for (const spec of lib.specifiers) {
      const mod = (await import(Bun.resolveSync(spec, pkgDir))) as Record<
        string,
        unknown
      >
      const lines = [
        '// AUTO-GENERATED by display-case — do not edit.',
        `import * as ns from '${spec}'`,
        '',
      ]
      for (const key of Object.keys(mod)) {
        if (key === 'default' || !IDENT.test(key) || RESERVED.has(key)) continue
        lines.push(`export const ${key} = ns.${key}`)
      }
      if ('default' in mod) lines.push('export default ns.default')
      const stem = vendorStem(spec)
      const file = join(cacheDir(pkgDir), `${stem}.ts`)
      await Bun.write(file, `${lines.join('\n')}\n`)
      entries.push({ specifier: spec, file, stem })
    }
  }
  return entries
}

/**
 * Build one publish surface in a fresh child process — never `Bun.build` in this
 * long-lived publish process (the bundler-heap segfault precondition the segfault
 * reports identified). A child that dies on a signal (a native bundler crash) is
 * contained and attributed to the surface, so publish fails with a clear message
 * and a non-zero exit instead of inheriting the native panic. Returns the
 * entry-point outputs (so the caller maps content-hashed basenames to asset URLs)
 * and the recorded module-graph inputs (so the caller can report inlined
 * duplication — see `reportInlinedDuplicates`).
 */
async function runPublishBuild(
  surface: string,
  req: PublishBuildRequest,
): Promise<{ outputs: { path: string; kind: string }[]; inputs: string[] }> {
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
  return { outputs: outcome.outputs ?? [], inputs: outcome.inputs ?? [] }
}

/** The installed package an absolute module path belongs to, or null when the path
 *  is not inside a `node_modules` tree (the consumer's own source). Handles scopes
 *  and the last `node_modules` segment (nested deps). */
function packageOfInput(path: string): string | null {
  const parts = path.split(sep)
  const i = parts.lastIndexOf('node_modules')
  if (i === -1 || i + 1 >= parts.length) return null
  const first = parts[i + 1] as string
  if (first.startsWith('@') && i + 2 < parts.length) {
    return `${first}/${parts[i + 2]}`
  }
  return first
}

/**
 * Advisory (Phase 3): report registry packages that ended up **inlined into more
 * than one** component's browser bundle — candidates the author could add to
 * `config.share` to deliver once. Reads each per-component build's recorded module
 * graph (the `inputs`); a package already shared is external and never appears as an
 * input, so it is excluded automatically. Estimates duplicated bytes from the source
 * sizes of the package's files in one bundle × the extra copies. Never changes the
 * build output or fails it — it only prints.
 */
async function reportInlinedDuplicates(
  perComponentInputs: string[][],
  shared: Set<string>,
): Promise<void> {
  // package → { components: count, files: Set of its input paths (any component) }
  const stats = new Map<string, { components: number; files: Set<string> }>()
  for (const inputs of perComponentInputs) {
    const here = new Map<string, Set<string>>()
    for (const p of inputs) {
      const pkg = packageOfInput(p)
      if (!pkg || shared.has(pkg)) continue
      let f = here.get(pkg)
      if (!f) {
        f = new Set()
        here.set(pkg, f)
      }
      f.add(p)
    }
    for (const [pkg, files] of here) {
      let s = stats.get(pkg)
      if (!s) {
        s = { components: 0, files: new Set() }
        stats.set(pkg, s)
      }
      s.components += 1
      for (const f of files) s.files.add(f)
    }
  }
  const candidates: { pkg: string; components: number; dupBytes: number }[] = []
  for (const [pkg, s] of stats) {
    if (s.components < 2) continue
    let bytes = 0
    for (const f of s.files) {
      try {
        bytes += (await Bun.file(f).stat()).size
      } catch {
        // a generated/virtual input with no on-disk size — skip it
      }
    }
    // Source bytes are a rough proxy; each extra component carries another copy.
    candidates.push({
      pkg,
      components: s.components,
      dupBytes: bytes * (s.components - 1),
    })
  }
  if (candidates.length === 0) return
  candidates.sort((a, b) => b.dupBytes - a.dupBytes)
  const kb = (n: number) => `${Math.round(n / 1024)} KB`
  console.log(
    `  ${candidates.length} librar${candidates.length === 1 ? 'y' : 'ies'} ` +
      'inlined into more than one component — add to `share` to deliver once:',
  )
  for (const c of candidates) {
    console.log(
      `    ${c.pkg} — in ${c.components} components, ~${kb(c.dupBytes)} duplicated (source)`,
    )
  }
}

export interface BuildDescriptor {
  title: string
  base: string
  a11y: false
  hasPrimer: boolean
  /** Content-hashed, base-prefixed entry URLs. `render` is per component
   *  (componentId → bundle URL) — the catalog is split, never one render entry.
   *  `importmap` maps each externalized bare specifier (the shared runtime
   *  libraries) to its one shared vendor bundle every browser surface imports
   *  instead of inlining its own copy. */
  assets: {
    browser: string
    render: Record<string, string>
    primer: string
    importmap: Record<string, string>
  }
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
    importmap: {} as Record<string, string>,
  }
  const Hashed = {
    entry: '[name]-[hash].[ext]',
    chunk: '[name]-[hash].[ext]',
    asset: '[name]-[hash].[ext]',
  }

  // Shared runtime libraries are shipped ONCE as vendor bundles and imported by the
  // chrome and every per-component bundle as external bare specifiers, resolved in
  // the browser by an importmap (see documents.ts). Without this, each per-component
  // browser bundle inlines its own copy of every shared library (e.g. ~150 KB React)
  // — N components meant N copies on the published site. React is always shared (the
  // rendering runtime every surface depends on); `config.share` adds more (a style
  // engine, markdown-to-jsx, a monorepo workspace package). The vendor builds
  // themselves bundle the libraries (pinReact pins the consumer's single React copy);
  // the externalized surface builds carry none.
  const sharedLibs = await resolveSharedLibs(pkgDir, config.share ?? [])
  const browserExternal = sharedLibs.flatMap((l) => l.specifiers)

  // One bounded `Bun.build` over every shared specifier's generated entry, with
  // `splitting` so code common to several specifiers (the React reconciler under
  // `react-dom` and `react-dom/client`) dedupes into one shared chunk. This is the
  // one place splitting is safe — a handful of entries, never the catalog — so the
  // crash-containment guarantee (no pass holds the whole catalog) is untouched.
  const vendorEntries = await codegenVendorEntries(pkgDir, sharedLibs)
  const vendorStemToSpec = new Map(
    vendorEntries.map((e) => [e.stem, e.specifier]),
  )
  const vendorOut = await runPublishBuild('the shared vendor bundles', {
    pkgDir,
    entrypoints: vendorEntries.map((e) => e.file),
    outdir: join(out, 'assets'),
    target: 'browser',
    minify: true,
    splitting: true,
    naming: Hashed,
    define: defines,
    pinReact: true,
  })
  for (const o of vendorOut.outputs) {
    if (o.kind !== 'entry-point') continue
    const spec = specifierForOutput(o.path, vendorStemToSpec)
    if (spec) assets.importmap[spec] = `${base}/assets/${basename(o.path)}`
  }

  // 1) Chrome bundle (the browse shell + optional primer) — carries no case
  // modules, so a small graph. Minified, content-hashed, production React. React
  // is external (resolved to the shared vendor bundle via importmap), not inlined —
  // which subsumes pinReact's job here (one consumer React copy, in vendor).
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
    external: browserExternal,
    // Exact match: an undeclared subpath (e.g. a shared package's own internal
    // `pkg/sub` import) inlines rather than leaking past the importmap as a bare
    // specifier the browser can't resolve.
    externalExact: true,
    pinReact: false,
  })
  for (const o of chromeOut.outputs) {
    const name = entryName(o.path)
    if (name) assets[name] = `${base}/assets/${basename(o.path)}`
  }

  // 2) Per-component browser render bundles — one isolated build each (a bounded,
  // single-component graph), content-hashed as `render-case-<id>-<hash>.js`. Run
  // through the bounded worker pool so a large catalog publishes concurrently
  // without ever holding the whole catalog as one graph.
  const perComponentInputs = await Promise.all(
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
          // Shared libraries external → their vendor bundles (importmap), not inlined
          // per component. This is the bundle-size win: each shared library once, ×1
          // not ×N (React always; whatever else the author declared to `share`).
          external: browserExternal,
          externalExact: true,
          pinReact: false,
        },
      )
      const ep = outs.outputs.find((o) => o.kind === 'entry-point')
      if (ep) assets.render[c.id] = `${base}/assets/${basename(ep.path)}`
      return outs.inputs
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
  //
  // Shared libraries diverge from the browser here by `origin`: a `published`
  // library stays external (the deploy `bun install`s it — see the generated
  // package.json) exactly as React does; a `workspace` library has no registry
  // coordinates, so it is *bundled* into each SSR renderer instead (a private package
  // can't be installed at deploy time, and duplicating it across SSR bundles is host
  // disk, not client bytes — the client still shares it via the browser vendor bundle).
  const ssrExternal = [
    'react',
    'react-dom',
    'react-dom/server',
    'react/jsx-runtime',
    'react/jsx-dev-runtime',
    ...sharedLibs
      .filter(
        (l) =>
          l.origin === 'published' &&
          l.package !== 'react' &&
          l.package !== 'react-dom',
      )
      .flatMap((l) => l.specifiers),
  ]
  const ssrBuilds: Promise<unknown>[] = []
  if (ssrPrimerEntry) {
    ssrBuilds.push(
      runPublishBuild('the primer renderer', {
        pkgDir,
        entrypoints: [ssrPrimerEntry],
        outdir: join(out, 'server'),
        target: 'bun',
        minify: true,
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
            minify: true,
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
  // The deployed showcase must install every `published` shared library so its SSR
  // renderers (which keep them external) resolve at runtime. React is always here;
  // declared published `share` packages join it. Workspace libraries are bundled into
  // the SSR renderers (no registry coordinates), so they are intentionally absent.
  // Ranges come from the consumer's own declared range when present, else
  // `^<installed version>`.
  const consumerRanges = await readConsumerRanges(pkgDir)
  const sharedDeps: Record<string, string> = {}
  for (const l of sharedLibs) {
    if (l.origin !== 'published') continue
    sharedDeps[l.package] =
      consumerRanges[l.package] ?? (l.version ? `^${l.version}` : 'latest')
  }
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
          ...sharedDeps,
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

  if (opts.static) {
    const { writeStaticExport } = await import('../server/prod-server')
    await writeStaticExport(out)
  }

  // Advisory: point out libraries inlined across more than one component that the
  // author could `share`. Never changes output or fails the build.
  await reportInlinedDuplicates(
    perComponentInputs,
    new Set(sharedLibs.map((l) => l.package)),
  )

  return { out, descriptor }
}
