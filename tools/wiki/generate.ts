/**
 * Wiki mirror generator.
 *
 * Display Case's documentation lives — canonically — in the repo (`docs/` is the
 * product guide, `contributing/` the engineering guide). Those files ship in the
 * npm tarball and are cloned with the repo, so they are the source AI agents read
 * (whether they consume Display Case or develop it). The GitHub wiki is a
 * *derived, human-browsable mirror* of that same content: never hand-edited,
 * regenerated from the repo so it cannot drift.
 *
 * This module turns the in-repo markdown into wiki-compatible pages:
 *   - flat page names (a wiki has no folders): `docs/cli.md` -> `CLI`
 *   - intra-doc links rewritten to wiki page links (anchors preserved)
 *   - links to code / non-doc files rewritten to absolute GitHub URLs
 *   - a generated `Home`, `_Sidebar`, and `_Footer`
 *   - a banner on every page pointing back at the canonical source file
 *
 * Run directly to emit pages into an output dir (default `.wiki-build/`):
 *   bun tools/wiki/generate.ts [outDir]
 * CI (`.github/workflows/wiki-sync.yml`) runs this and pushes the result to the
 * `*.wiki.git` repo.
 */
import { existsSync, statSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join, posix, relative, resolve } from 'node:path'

/** Repo root, resolved relative to this file (tools/wiki/ -> ../..). */
export const REPO_ROOT = resolve(import.meta.dir, '..', '..')

/** "owner/repo", parsed from package.json's repository url. */
export function repoSlug(repoUrl: string): string {
  const slug = repoUrl.match(/github\.com[/:]([^/]+\/[^/]+?)(?:\.git)?$/)?.[1]
  if (!slug) throw new Error(`Cannot parse GitHub slug from: ${repoUrl}`)
  return slug
}

/**
 * The doc trees to mirror, in sidebar order. Each is a section in the sidebar
 * and Home page. `*.placard.md` / `*.case.tsx` under these trees are runnable
 * fixtures, not prose — they are excluded (linked to as code instead).
 */
export const SECTIONS: ReadonlyArray<{ title: string; dir: string }> = [
  { title: 'Product documentation', dir: 'docs' },
  { title: 'Contributing (engineering)', dir: 'contributing' },
]

/**
 * Explicit page names for files whose auto-derived name would be wrong
 * (acronyms, generic basenames, or two `README.md` that would collide).
 * Keyed by repo-relative POSIX path.
 */
const PAGE_OVERRIDES: Readonly<Record<string, string>> = {
  'docs/ai-agents.md': 'AI-Agents',
  'docs/cli.md': 'CLI',
  'docs/examples/README.md': 'Examples',
  'contributing/README.md': 'Contributing',
  'contributing/NOTES.md': 'Engineering-Notes',
}

/** A file is a fixture (code), not a wiki page, if it ends like this. */
const FIXTURE_SUFFIXES = ['.placard.md', '.case.tsx']

/** Title-case a hyphenated basename: `writing-placard-docs` -> `Writing-Placard-Docs`. */
function titleCase(base: string): string {
  return base
    .split('-')
    .map((s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s))
    .join('-')
}

/** Wiki page name for a repo-relative doc path. */
export function pageNameFor(repoRel: string): string {
  const key = repoRel.split('/').join(posix.sep)
  if (PAGE_OVERRIDES[key]) return PAGE_OVERRIDES[key]
  const base = key.slice(key.lastIndexOf('/') + 1).replace(/\.md$/, '')
  return titleCase(base)
}

/** Friendly sidebar label from a page name: `Writing-Cases` -> `Writing Cases`. */
export function labelFor(page: string): string {
  return page.split('-').join(' ')
}

/** Discover the markdown files to mirror, keyed repo-relative -> page name. */
export async function buildRegistry(
  rootDir: string = REPO_ROOT,
): Promise<Map<string, string>> {
  const registry = new Map<string, string>()
  const claimedBy = new Map<string, string>() // page name -> source path
  for (const { dir } of SECTIONS) {
    const glob = new Bun.Glob('**/*.md')
    for await (const rel of glob.scan({ cwd: join(rootDir, dir) })) {
      if (FIXTURE_SUFFIXES.some((s) => rel.endsWith(s))) continue
      const repoRel = posix.join(dir, rel.split('/').join(posix.sep))
      const page = pageNameFor(repoRel)
      // A wiki is a flat namespace: two docs deriving the same page name would
      // silently overwrite each other's output. Fail loud — add a PAGE_OVERRIDES
      // entry to disambiguate.
      const owner = claimedBy.get(page)
      if (owner) {
        throw new Error(
          `Wiki page name collision: "${owner}" and "${repoRel}" both map to "${page}". Add a PAGE_OVERRIDES entry to disambiguate.`,
        )
      }
      claimedBy.set(page, repoRel)
      registry.set(repoRel, page)
    }
  }
  return registry
}

type RewriteOptions = {
  registry: Map<string, string>
  slug: string
  /** Whether a repo-relative path exists in the tree (default: filesystem). */
  exists?: (repoRel: string) => boolean
  /** Whether a repo-relative path is a directory, for blob vs tree URLs. */
  isDirectory?: (repoRel: string) => boolean
}

function pathExists(repoRel: string, opts: RewriteOptions): boolean {
  return opts.exists
    ? opts.exists(repoRel)
    : existsSync(join(REPO_ROOT, repoRel))
}

function pathIsDir(repoRel: string, opts: RewriteOptions): boolean {
  if (opts.isDirectory) return opts.isDirectory(repoRel)
  const abs = join(REPO_ROOT, repoRel)
  return existsSync(abs) && statSync(abs).isDirectory()
}

/** GitHub URL for a non-page file/dir reference. */
function gitHubUrl(
  repoRel: string,
  opts: RewriteOptions,
  isImage: boolean,
): string {
  if (isImage) {
    return `https://raw.githubusercontent.com/${opts.slug}/main/${repoRel}`
  }
  const kind = pathIsDir(repoRel, opts) ? 'tree' : 'blob'
  return `https://github.com/${opts.slug}/${kind}/main/${repoRel}`
}

/** Strip a trailing slash and a leading `./`. */
function clean(p: string): string {
  return p.replace(/^\.\//, '').replace(/\/$/, '')
}

/**
 * Rewrite all relative links in one doc so they resolve inside the wiki.
 *   - `http(s)://…`, `mailto:`, and same-page `#anchor` links: untouched
 *   - link to a mirrored doc: -> `Page-Name` (anchor preserved)
 *   - link to any other repo file/dir: -> absolute GitHub URL
 *
 * Links are resolved relative to the source file's directory, as GitHub does.
 * If that misses (a path that doesn't exist in the tree) but the same path
 * resolved from the repo root *does* exist, the root resolution is used — some
 * source docs author repo-root-relative paths (e.g. `openspec/...` from a file
 * under `contributing/`), which would otherwise 404.
 */
export function rewriteLinks(
  markdown: string,
  srcRepoRel: string,
  opts: RewriteOptions,
): string {
  const srcDir = posix.dirname(srcRepoRel)
  // Matches [text](target) and ![alt](target), with an optional "title".
  const linkRe = /(!?)\[([^\]]*)\]\(([^)\s]+)(\s+"[^"]*")?\)/g
  return markdown.replace(linkRe, (full, bang, text, target, title = '') => {
    if (/^(?:https?:|mailto:|#)/.test(target)) return full

    const hashIdx = target.indexOf('#')
    const rawPath = hashIdx === -1 ? target : target.slice(0, hashIdx)
    const anchor = hashIdx === -1 ? '' : target.slice(hashIdx)
    if (!rawPath) return full // pure anchor, already handled above

    let repoRel = clean(posix.normalize(posix.join(srcDir, rawPath)))
    if (!opts.registry.has(repoRel) && !pathExists(repoRel, opts)) {
      // Fall back to repo-root resolution for root-relative authored paths.
      const rootRel = clean(
        posix.normalize(rawPath.replace(/^(?:\.\.\/)+/, '')),
      )
      if (opts.registry.has(rootRel) || pathExists(rootRel, opts))
        repoRel = rootRel
    }

    const page = opts.registry.get(repoRel)
    const newTarget = page
      ? `${page}${anchor}`
      : `${gitHubUrl(repoRel, opts, bang === '!')}${anchor}`
    return `${bang}[${text}](${newTarget}${title})`
  })
}

/** Banner prepended to every mirrored page. */
function banner(srcRepoRel: string, slug: string): string {
  const url = `https://github.com/${slug}/blob/main/${srcRepoRel}`
  return `> 🔄 **Auto-generated mirror.** Canonical source: [\`${srcRepoRel}\`](${url}). Edit there — changes here are overwritten by CI.\n\n`
}

/** Build the full page body for one source doc. */
export async function renderPage(
  repoRel: string,
  rootDir: string,
  opts: RewriteOptions,
): Promise<string> {
  const raw = await readFile(join(rootDir, repoRel), 'utf8')
  return banner(repoRel, opts.slug) + rewriteLinks(raw, repoRel, opts)
}

/** The `_Sidebar.md` navigation, grouped by section. */
export function renderSidebar(registry: Map<string, string>): string {
  const lines = ['### Display Case', '', '[Home](Home)', '']
  for (const { title, dir } of SECTIONS) {
    const pages = [...registry.entries()]
      .filter(([rel]) => rel === dir || rel.startsWith(`${dir}/`))
      .map(([, page]) => page)
      .sort((a, b) => labelFor(a).localeCompare(labelFor(b)))
    if (!pages.length) continue
    lines.push(`**${title}**`, '')
    for (const page of pages) lines.push(`- [${labelFor(page)}](${page})`)
    lines.push('')
  }
  return lines.join('\n')
}

/** The `Home.md` landing page. */
export function renderHome(
  registry: Map<string, string>,
  slug: string,
): string {
  const out = [
    '# Display Case',
    '',
    `> 🔄 This wiki is an **auto-generated, browsable mirror** of the documentation that lives in the [Display Case repository](https://github.com/${slug}). The repo is the source of truth — it ships in the npm package and is what AI agents read. Pages here are regenerated by CI; do not edit them by hand.`,
    '',
    'Looking to *use* Display Case from code or an agent? The same docs are bundled in the package under `node_modules/@awarebydefault/display-case/docs/`.',
    '',
  ]
  for (const { title, dir } of SECTIONS) {
    const pages = [...registry.entries()]
      .filter(([rel]) => rel === dir || rel.startsWith(`${dir}/`))
      .map(([, page]) => page)
      .sort((a, b) => labelFor(a).localeCompare(labelFor(b)))
    if (!pages.length) continue
    out.push(`## ${title}`, '')
    for (const page of pages) out.push(`- [${labelFor(page)}](${page})`)
    out.push('')
  }
  return out.join('\n')
}

/** The `_Footer.md` shown under every page. */
export function renderFooter(slug: string): string {
  return `_Auto-generated mirror of the [Display Case docs](https://github.com/${slug}/tree/main/docs). Edit the repo, not the wiki._`
}

/** Generate every page into `outDir`, returning the file names written. */
export async function generate(
  outDir: string,
  rootDir: string = REPO_ROOT,
): Promise<string[]> {
  const pkg = JSON.parse(await readFile(join(rootDir, 'package.json'), 'utf8'))
  const slug = repoSlug(pkg.repository.url)
  const registry = await buildRegistry(rootDir)
  const opts: RewriteOptions = { registry, slug }

  await rm(outDir, { recursive: true, force: true })
  await mkdir(outDir, { recursive: true })

  const written: string[] = []
  for (const [repoRel, page] of registry) {
    await writeFile(
      join(outDir, `${page}.md`),
      await renderPage(repoRel, rootDir, opts),
    )
    written.push(`${page}.md`)
  }
  await writeFile(join(outDir, 'Home.md'), renderHome(registry, slug))
  await writeFile(join(outDir, '_Sidebar.md'), renderSidebar(registry))
  await writeFile(join(outDir, '_Footer.md'), renderFooter(slug))
  written.push('Home.md', '_Sidebar.md', '_Footer.md')
  return written.sort()
}

if (import.meta.main) {
  const outDir = resolve(process.argv[2] ?? join(REPO_ROOT, '.wiki-build'))
  const written = await generate(outDir)
  const rel = relative(process.cwd(), outDir) || '.'
  console.log(`Wrote ${written.length} wiki pages to ${rel}/`)
  for (const f of written) console.log(`  ${f}`)
}
