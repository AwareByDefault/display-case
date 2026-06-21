import { dirname, isAbsolute, join, resolve } from 'node:path'

/**
 * Change-scoping support: compute, for a set of changed files, which components
 * a render-time check (a11y / visual) actually needs to re-run.
 *
 * A component is "affected" when any changed file lies in the *import closure*
 * of its case file — the case itself, the component it imports, and everything
 * those pull in transitively (including `@import`ed CSS). The closure follows
 * only **relative** specifiers: a Display Case showcase is dependency-light and
 * a pull request virtually never edits a node_modules package, so bare imports
 * (`react`, `display-case`, …) are intentionally not traced. This keeps the
 * analysis a pure, fast file walk with no bundler or module-graph dependency.
 *
 * Everything here is pure (path + file reads only) so it is unit-testable
 * without a server, a browser, or git.
 */

// Extensions we try when a relative specifier omits one, in resolution order.
// A specifier that already carries an extension (e.g. `./styles.css`) resolves
// via the bare candidate first.
const RESOLVE_EXTS = [
  '.tsx',
  '.ts',
  '.jsx',
  '.js',
  '.mjs',
  '.cjs',
  '.css',
  '.json',
] as const

// Relative import/export specifiers in a JS/TS source. Covers `import … from`,
// `export … from`, side-effect `import '…'`, and dynamic `import('…')` /
// `require('…')`. Source-level regexes (not a parser) — good enough for a
// dependency walk and free of any parsing dependency.
const JS_FROM = /(?:import|export)\b[^;'"]*?\bfrom\s*['"]([^'"]+)['"]/g
const JS_BARE = /\bimport\s*['"]([^'"]+)['"]/g
const JS_DYNAMIC = /\b(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)/g
// `@import '…'` / `@import "…"` / `@import url(…)` in CSS.
const CSS_IMPORT = /@import\s+(?:url\(\s*)?['"]([^'"]+)['"]/g

function specifiers(source: string, isCss: boolean): string[] {
  const out: string[] = []
  const collect = (re: RegExp) => {
    re.lastIndex = 0
    for (let m = re.exec(source); m; m = re.exec(source)) out.push(m[1])
  }
  if (isCss) {
    collect(CSS_IMPORT)
  } else {
    collect(JS_FROM)
    collect(JS_BARE)
    collect(JS_DYNAMIC)
  }
  return out
}

function* candidates(base: string): Generator<string> {
  yield base
  for (const ext of RESOLVE_EXTS) yield base + ext
  for (const ext of RESOLVE_EXTS) yield join(base, `index${ext}`)
}

/** Resolve a relative specifier to an absolute file path, or null. Bare
 *  specifiers (not starting with `.` or `/`) are not traced and return null. */
async function resolveSpecifier(
  fromFile: string,
  spec: string,
): Promise<string | null> {
  if (!spec.startsWith('.') && !spec.startsWith('/')) return null
  const base = isAbsolute(spec) ? spec : resolve(dirname(fromFile), spec)
  for (const cand of candidates(base)) {
    if (await Bun.file(cand).exists()) return cand
  }
  return null
}

/**
 * The transitive relative-import closure of one or more entry files, as a set
 * of absolute paths that includes the entries themselves. Files that can't be
 * read are skipped (an entry pointing at a deleted file contributes only
 * itself).
 */
export async function importClosure(entries: string[]): Promise<Set<string>> {
  const seen = new Set<string>()
  const queue = entries.map((e) => resolve(e))
  while (queue.length) {
    const file = queue.pop()
    if (!file || seen.has(file)) continue
    seen.add(file)
    let source: string
    try {
      source = await Bun.file(file).text()
    } catch {
      continue
    }
    for (const spec of specifiers(source, file.endsWith('.css'))) {
      const resolved = await resolveSpecifier(file, spec)
      if (resolved && !seen.has(resolved)) queue.push(resolved)
    }
  }
  return seen
}

/** Each component's import closure, keyed by component id. */
export async function componentClosures(
  components: { id: string; caseFile: string }[],
): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>()
  for (const c of components) map.set(c.id, await importClosure([c.caseFile]))
  return map
}

/**
 * The subset of `components` affected by `changedFiles` — i.e. those whose case
 * file's import closure contains at least one changed file. `changedFiles` and
 * each `caseFile` are absolute paths.
 *
 * Note: this attributes a changed file to a component only when that file is in
 * the component's *import closure*. A changed file that no closure claims (e.g.
 * globally-inlined CSS, the render pipeline) is invisible here — the caller is
 * responsible for treating such an unattributed render-input as affecting every
 * component. See `componentClosures` for building the closures once to make that
 * coverage check.
 */
export async function affectedComponents(
  components: { id: string; caseFile: string }[],
  changedFiles: Iterable<string>,
): Promise<Set<string>> {
  const changed = new Set<string>()
  for (const f of changedFiles) changed.add(resolve(f))
  const closures = await componentClosures(components)
  const affected = new Set<string>()
  for (const [id, files] of closures) {
    for (const f of files) {
      if (changed.has(f)) {
        affected.add(id)
        break
      }
    }
  }
  return affected
}
