import { mkdir } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import type { BuildDescriptor } from '../commands/publish'
import type { Manifest } from '../core/manifest'
import type { Substrate } from '../core/substrate'
import type { DisplayCaseConfig } from '../index'
import { primerDoc, shellDoc } from '../render/documents'
import type { PrimerHtmlResult } from '../render/ssr-primer'
import type { CaseRenderer } from '../render/ssr-render'
import { renderShellToHtml } from '../render/ssr-shell'
import { renderVariants } from '../substrate/resolve'
import type { Theme } from '../ui/shell-core'

/**
 * The production host for a published build. It serves the pre-rendered shell,
 * isolated case render, and primer documents — rendered on request through the
 * SAME renderers the dev server uses (`ssr-shell`/`ssr-render`/`ssr-primer`) —
 * plus the content-hashed assets, with hosting-appropriate caching, a health
 * endpoint, and base-path support. It carries NONE of the dev machinery: no
 * watcher, no rebuild, no live-reload stream, no on-demand a11y, no dev
 * endpoints. Build once, serve.
 */

const ASSET_CACHE = 'public, max-age=31536000, immutable'
const HTML_CACHE = 'no-cache'

interface Loaded {
  buildDir: string
  descriptor: BuildDescriptor
  manifest: Manifest
  renderCase: CaseRenderer
  renderPrimer: (() => PrimerHtmlResult) | null
  /** The showcase's substrate, bundled into the build. It owns every isolated
   *  render document, so the host serves through it rather than assuming HTML. */
  substrate: Substrate
  /** The showcase config the substrate was resolved from, as the substrate's
   *  own `document()` needs it (theme signals, style engines). */
  config: DisplayCaseConfig
}

async function load(buildDir: string): Promise<Loaded> {
  const descriptor = (await Bun.file(
    join(buildDir, 'dc-build.json'),
  ).json()) as BuildDescriptor
  const manifest = (await Bun.file(
    join(buildDir, 'manifest.json'),
  ).json()) as Manifest
  // Each component is published as its own SSR bundle (`ssr-case-<id>.js`), built
  // separately so the catalog is never one graph. Import them by component id and
  // dispatch — importing is module evaluation (safe), unlike bundling them as one.
  const renderers = new Map<string, CaseRenderer>()
  for (const c of manifest.components) {
    const mod = (await import(
      join(buildDir, 'server', `ssr-case-${c.id}.js`)
    )) as { renderCaseToHtml: CaseRenderer }
    renderers.set(c.id, mod.renderCaseToHtml)
  }
  const { substrate, config } = (await import(
    join(buildDir, 'server', 'substrate.js')
  )) as { substrate: Substrate; config: DisplayCaseConfig }
  const renderCase: CaseRenderer = async (state, variants, params) => {
    const r = renderers.get(state.componentId)
    // No such component → nothing pre-rendered; the stage mounts nothing (the
    // chrome shows a not-found state). Mirrors a client-only case's empty
    // render, and the empty frame comes from the substrate, not from here.
    if (!r) {
      return {
        frame: await substrate.render(null, {
          componentId: state.componentId,
          caseId: state.caseId,
          tweaks: state.tweaks,
          variants: variants ?? {},
          params: params ?? {},
          clientOnly: true,
          config,
        }),
        browserOnly: true,
      }
    }
    return r(state, variants, params)
  }
  let renderPrimer: (() => PrimerHtmlResult) | null = null
  if (descriptor.hasPrimer) {
    const pMod = (await import(
      join(buildDir, 'server', 'ssr-primer-entry.js')
    )) as { renderPrimerToHtml: () => PrimerHtmlResult }
    renderPrimer = pMod.renderPrimerToHtml
  }
  return {
    buildDir,
    descriptor,
    manifest,
    renderCase,
    renderPrimer,
    substrate,
    config,
  }
}

function parseRenderState(url: URL) {
  const parts = url.pathname.split('/').filter(Boolean)
  const p = url.searchParams
  const tweaks: Record<string, string> = {}
  for (const [k, v] of p) if (k.startsWith('t.')) tweaks[k.slice(2)] = v
  const widthParam = p.get('width')
  // path shape (after base strip): /render/<component>/<case>
  return {
    componentId: parts[1] ?? '',
    caseId: parts[2] ?? '',
    theme: (p.get('theme') === 'dark' ? 'dark' : 'light') as Theme,
    width: widthParam ? Number(widthParam) : null,
    tweaks,
    fit: p.get('fit') === '1',
    transparent: p.get('transparent') === '1',
  }
}

/** The substrate-defined address options, in the shape `document()` reads. */
function renderParams(rs: {
  fit: boolean
  transparent: boolean
  width: number | null
}): Record<string, string> {
  const params: Record<string, string> = {}
  if (rs.fit) params.fit = '1'
  if (rs.transparent) params.transparent = '1'
  if (rs.width !== null) params.width = String(rs.width)
  return params
}

/** Render the document for an internal path (base already stripped) + query.
 *  Returns null for non-document paths (assets/health handled by the caller). */
async function documentFor(
  loaded: Loaded,
  path: string,
  url: URL,
): Promise<string> {
  const { descriptor, manifest, renderCase, renderPrimer, substrate, config } =
    loaded
  const assets = descriptor.assets
  const theme: Theme =
    url.searchParams.get('theme') === 'dark' ? 'dark' : 'light'

  if (path === '/render/primer') {
    let markup = ''
    let ssr = false
    let headStyles: string | undefined
    if (renderPrimer) {
      const r = renderPrimer()
      if (!r.browserOnly) {
        markup = r.html
        ssr = true
        headStyles = r.headStyles
      }
    }
    return primerDoc({
      tokensCss: descriptor.tokensCss,
      globalCss: descriptor.globalCss,
      vitrineCss: descriptor.vitrineCss,
      theme,
      signals: descriptor.themeSignals,
      markup,
      ssr,
      headStyles,
      assets,
    })
  }

  if (path === '/render' || path.startsWith('/render/')) {
    const rs = parseRenderState(url)
    // Every render-kind axis the substrate declares, defaults filled in.
    const variants = renderVariants(url.searchParams, substrate)
    const params = renderParams(rs)
    const r = await renderCase(
      {
        componentId: rs.componentId,
        caseId: rs.caseId,
        width: rs.width,
        tweaks: rs.tweaks,
      },
      variants,
      params,
    )
    // The substrate owns the whole document. The published build differs from
    // the dev server's only in carrying an importmap and no dev injects — both
    // parameters of the same call, which is why there is no second template.
    return substrate.document(r.frame, {
      componentId: rs.componentId,
      caseId: rs.caseId,
      tweaks: rs.tweaks,
      variants,
      params,
      config,
      // This component's own bundle (the catalog is split per component).
      scriptSrc: assets.render[rs.componentId] ?? '',
      importmap: assets.importmap,
      prerendered: !r.browserOnly,
      hostScripts: '',
      resources: {
        globalCss: descriptor.globalCss,
        vitrineCss: descriptor.vitrineCss,
      },
    })
  }

  // Shell: `/`, `/primer`, every `/c/...` deep link.
  const shell = renderShellToHtml({
    manifest,
    pathname: path,
    search: url.search,
    theme,
    a11y: false,
  })
  return shellDoc({
    title: descriptor.title,
    tokensCss: descriptor.tokensCss,
    globalCss: descriptor.globalCss,
    vitrineCss: descriptor.vitrineCss,
    theme,
    signals: descriptor.themeSignals,
    markup: shell.html,
    ssr: shell.ssr,
    manifest,
    a11y: false,
    assets,
  })
}

export async function startProdServer(
  buildDir: string,
  opts: { port?: number } = {},
) {
  const loaded = await load(buildDir)
  const base = loaded.descriptor.base

  const server = Bun.serve({
    port: opts.port ?? 3000,
    async fetch(req) {
      const url = new URL(req.url)
      let path = url.pathname
      if (base && (path === base || path.startsWith(`${base}/`))) {
        path = path.slice(base.length) || '/'
      }

      if (path === '/health') return new Response('ok')

      if (path.startsWith('/assets/')) {
        const assetsDir = join(buildDir, 'assets')
        const abs = resolve(assetsDir, path.slice('/assets/'.length))
        // Defense-in-depth: never serve outside the assets dir even if a crafted
        // path slips a `..` past `URL` normalization.
        if (abs !== assetsDir && !abs.startsWith(assetsDir + sep)) {
          return new Response('not found', { status: 404 })
        }
        const file = Bun.file(abs)
        if (!(await file.exists())) {
          return new Response('not found', { status: 404 })
        }
        return new Response(file, { headers: { 'cache-control': ASSET_CACHE } })
      }

      return new Response(await documentFor(loaded, path, url), {
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': HTML_CACHE,
        },
      })
    },
  })
  return server
}

/**
 * Crawl every address and write complete HTML files, so the build can be hosted
 * with no running server. Files are keyed by *path* (default theme + tweaks);
 * address-encoded variations resolve on the client after hydration — logged so
 * the boundary is explicit, not silent.
 */
export async function writeStaticExport(buildDir: string): Promise<void> {
  const loaded = await load(buildDir)
  const { manifest } = loaded
  const write = async (route: string, file: string) => {
    const url = new URL(`http://static${route}`)
    const html = await documentFor(loaded, url.pathname, url)
    const abs = join(buildDir, file)
    await mkdir(dirname(abs), { recursive: true })
    await Bun.write(abs, html)
  }

  await write('/', 'index.html')
  if (loaded.descriptor.hasPrimer) {
    await write('/primer', 'primer/index.html')
    await write('/render/primer', 'render/primer/index.html')
  }
  let pages = 2
  for (const c of manifest.components) {
    for (const cs of c.cases) {
      await write(`/c/${c.id}/${cs.id}`, `c/${c.id}/${cs.id}/index.html`)
      await write(
        `/render/${c.id}/${cs.id}`,
        `render/${c.id}/${cs.id}/index.html`,
      )
      pages += 2
    }
  }
  // What happens to an address-encoded variation that has no per-path file
  // depends on whether the substrate can render in the client at all. With a
  // stage runtime, the page resolves it after hydration as it always has.
  // Without one, every rendering is server-produced — so such an address simply
  // has no file, and saying it "resolves on the client" would be false.
  const clientRenderable = Boolean(loaded.substrate.stage)
  console.log(
    `  static export: ${pages} page(s). Note: query-encoded tweak/variant ` +
      (clientRenderable
        ? 'variations have no per-path file — they resolve on the client after hydration.'
        : `variations have no per-path file, and the "${loaded.substrate.id}" ` +
          'substrate renders only on the server — those addresses are ' +
          'unavailable in a static export. Host the build with its server to ' +
          'reach them.'),
  )
}
