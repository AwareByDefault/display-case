import { Glob } from 'bun'
import type { CaseModule, DisplayCaseConfig } from '../index'
import { isSurfaceLevel, normalizeGroup } from '../index'
import type { ManifestGroup } from './manifest'

// Re-export so callers (and tests) can import the surface predicate from here.
export { isSurfaceLevel }

/**
 * Information-architecture group resolution for the Exhibits browse mode.
 *
 * Pages and flows ("surfaces") are organized by a nestable `group` path,
 * resolved first-match-wins: an explicit `group` on the case → derived from the
 * case file's folder (on by default) → a configured surface→group rule → the
 * default group (empty path). Building-block levels (atom–template) carry no
 * group. This module is server-side (it reads config + paths and uses `Glob`);
 * the pure browser catalog stays config-free and receives the resolver.
 */

/** The static (wildcard-free) directory prefix of a roots glob, with its trailing slash. */
function globStaticPrefix(glob: string): string {
  const wildcard = glob.search(/[*?[\]{}]/)
  const head = wildcard === -1 ? glob : glob.slice(0, wildcard)
  const slash = head.lastIndexOf('/')
  return slash === -1 ? '' : head.slice(0, slash + 1)
}

/** Title-case a folder segment for display, stripping route-group parens and a
 *  leading private/underscore marker (`(marketing)` → `Marketing`, `_x` → `X`). */
function normalizeSegment(raw: string): string {
  let s = raw.trim()
  if (s.startsWith('(') && s.endsWith(')')) s = s.slice(1, -1)
  s = s.replace(/^_+/, '')
  return s
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/**
 * Derive a group path from a case file's package-relative `sourcePath`, taken
 * relative to the matched discovery root. Returns `[]` when no root matches or
 * the file sits directly in the root (no subfolder).
 */
export function deriveGroupFromFolder(
  sourcePath: string,
  roots: string[],
): string[] {
  for (const glob of roots) {
    const prefix = globStaticPrefix(glob)
    if (prefix !== '' && !sourcePath.startsWith(prefix)) continue
    const rest = sourcePath.slice(prefix.length)
    const parts = rest.split('/')
    parts.pop() // drop the filename
    const segs = parts.map(normalizeSegment).filter(Boolean)
    if (segs.length) return segs
  }
  return []
}

/** Kebab-slug a name the same way the catalog does (local copy to avoid a cycle). */
function slug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function matchesRule(
  rule: NonNullable<NonNullable<DisplayCaseConfig['nav']>['surface']>[number],
  mod: CaseModule,
): boolean {
  if (rule.area != null && mod.area === rule.area) return true
  if (rule.id != null) {
    if (slug(mod.component) === rule.id) return true
    if (mod.sourcePath && new Glob(rule.id).match(mod.sourcePath)) return true
  }
  return false
}

/**
 * Build a `(module) => groupPath` resolver bound to a showcase config. Pass it to
 * `buildCatalog` so each surface carries its resolved group; non-surfaces get `[]`.
 */
export function makeGroupResolver(
  config: DisplayCaseConfig,
): (mod: CaseModule) => string[] {
  const deriveFolder = config.nav?.deriveFromFolder !== false
  const rules = config.nav?.surface ?? []
  return (mod) => {
    if (!isSurfaceLevel(mod.level)) return []
    if (mod.group?.length) return mod.group
    if (deriveFolder && mod.sourcePath) {
      const derived = deriveGroupFromFolder(mod.sourcePath, config.roots)
      if (derived.length) return derived
    }
    for (const rule of rules) {
      if (matchesRule(rule, mod)) return normalizeGroup(rule.group)
    }
    return []
  }
}

interface MutableNode {
  segment: string
  path: string[]
  children: Map<string, MutableNode>
}

function orderIndex(node: MutableNode, order: string[]): number {
  const joined = node.path.join('/').toLowerCase()
  const seg = node.segment.toLowerCase()
  const i = order.findIndex((o) => {
    const k = o.trim().toLowerCase()
    return k === joined || k === seg
  })
  return i === -1 ? Number.POSITIVE_INFINITY : i
}

function emit(
  nodes: Map<string, MutableNode>,
  groups: NonNullable<DisplayCaseConfig['nav']>['groups'],
): ManifestGroup[] {
  const order = groups?.order ?? []
  const labels = groups?.labels ?? {}
  const collapsed = (groups?.collapsed ?? []).map((c) => c.trim().toLowerCase())
  // Stable: keep insertion order, then float config-ordered groups to the front.
  const arr = [...nodes.values()]
  arr.sort((a, b) => orderIndex(a, order) - orderIndex(b, order))
  return arr.map((node) => {
    const joined = node.path.join('/').toLowerCase()
    const seg = node.segment.toLowerCase()
    const label = labels[joined] ?? labels[seg] ?? node.segment
    return {
      label,
      path: node.path,
      collapsed: collapsed.includes(joined) || collapsed.includes(seg),
      children: emit(node.children, groups),
    }
  })
}

/**
 * Build the nested Exhibits group tree from resolved surface group paths,
 * honoring config order/labels/default-collapsed. Components with an empty group
 * (the default group) contribute no node.
 */
export function buildGroupTree(
  components: { group: string[] }[],
  config: DisplayCaseConfig,
): ManifestGroup[] {
  const roots = new Map<string, MutableNode>()
  for (const c of components) {
    if (!c.group || c.group.length === 0) continue
    let level = roots
    const acc: string[] = []
    for (const segment of c.group) {
      acc.push(segment)
      const key = segment.toLowerCase()
      let node = level.get(key)
      if (!node) {
        node = { segment, path: [...acc], children: new Map() }
        level.set(key, node)
      }
      level = node.children
    }
  }
  return emit(roots, config.nav?.groups)
}
