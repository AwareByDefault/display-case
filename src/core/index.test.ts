import { describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

/**
 * The `./core` subpath is the surface an out-of-tree substrate is implemented
 * against, and its whole value is that it stays substrate-neutral. That is a
 * property of the *module graph*, not of the entry file: one `import` added
 * three modules deep would quietly drag the dev server (and Playwright, and the
 * bundler) into every substrate implementor's dependency tree.
 *
 * So walk the real graph and assert the layering, rather than trusting review.
 */

const SRC = resolve(import.meta.dir, '..')
const ENTRY = join(SRC, 'core', 'index.ts')

/** Layers that sit *above* the core; reaching one inverts the import direction. */
const FORBIDDEN_LAYERS = ['server', 'checks', 'commands', 'ui']

const transpiler = new Bun.Transpiler({ loader: 'tsx' })

/** Resolve a relative specifier to a real file, trying the extensions Bun does. */
function resolveSpecifier(fromFile: string, spec: string): string | null {
  const base = resolve(dirname(fromFile), spec)
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ]
  return candidates.find((c) => existsSync(c) && !c.endsWith('/')) ?? null
}

/** Every file reachable from `entry` through relative imports, entry included. */
async function moduleGraph(entry: string): Promise<Map<string, string[]>> {
  const graph = new Map<string, string[]>()
  const queue = [entry]
  while (queue.length) {
    const file = queue.pop()
    if (!file || graph.has(file)) continue
    const source = await Bun.file(file).text()
    const deps: string[] = []
    for (const imp of transpiler.scanImports(source)) {
      // Bare specifiers (react, bun, node:path) leave the repo — not our concern.
      if (!imp.path.startsWith('.')) continue
      const resolved = resolveSpecifier(file, imp.path)
      if (!resolved) continue
      deps.push(resolved)
      queue.push(resolved)
    }
    graph.set(file, deps)
  }
  return graph
}

describe('core export module graph', () => {
  test('reaches nothing in server/, checks/, commands/, or ui/', async () => {
    const graph = await moduleGraph(ENTRY)
    const violations: string[] = []
    for (const [file, deps] of graph) {
      for (const dep of deps) {
        const rel = relative(SRC, dep)
        const layer = rel.split('/')[0]
        if (layer && FORBIDDEN_LAYERS.includes(layer)) {
          violations.push(`${relative(SRC, file)} → ${rel}`)
        }
      }
    }
    expect(violations).toEqual([])
  })

  test('walks a real graph, so the check cannot pass vacuously', async () => {
    const graph = await moduleGraph(ENTRY)
    // The entry re-exports from index, discovery, catalog, manifest, groups,
    // substrate, and render-node — a graph this small would mean resolution
    // silently failed and nothing was actually inspected.
    expect(graph.size).toBeGreaterThanOrEqual(7)
    expect([...graph.keys()]).toContain(join(SRC, 'render', 'render-node.tsx'))
    expect([...graph.keys()]).toContain(join(SRC, 'index.ts'))
  })

  test('exposes the substrate contract and the case-tree builder', async () => {
    const core = await import('./index')
    expect(typeof core.caseTree).toBe('function')
    expect(typeof core.resolveTweaks).toBe('function')
    expect(typeof core.encodeOverrides).toBe('function')
    expect(typeof core.defineCases).toBe('function')
    expect(typeof core.buildCatalog).toBe('function')
    expect(typeof core.resolveConfig).toBe('function')
  })
})
