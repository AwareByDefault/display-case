import { sep } from 'node:path'
import { slugify } from '../core/catalog'
import {
  discoverCaseFiles,
  loadModules,
  resolveConfig,
} from '../core/discovery'
import { spawnBuildWorker } from '../server/build-runner'

/**
 * The **bundle-graph budget** check. For each component it measures the *real*
 * bundled module graph — by building the component in the same crash-contained
 * build worker the server/publish use (so measuring a pathological graph can
 * never crash the tool) and reading the module inputs the bundler actually
 * loaded — then flags two risks the segfault reports identified as precursors to
 * the large-graph Bun bundler crash:
 *
 *  - **over budget** — the component's total module count exceeds a ceiling;
 *  - **a barrel import** — one dependency package contributes a disproportionate
 *    share of the graph (e.g. importing a whole icon set rather than the icons
 *    used).
 *
 * The analysis (`analyzeComponentGraph`) is pure and unit-tested; the phase
 * orchestration builds each component and maps the result to findings.
 */

/** Built-in budgets, used when a field is unconfigured. Deliberately loose: the
 *  true crash size is machine-dependent, so these only fire on genuinely
 *  dangerous graphs/barrels. */
export const DEFAULT_GRAPH_BUDGET = { modules: 1500, perPackage: 400 } as const

export interface GraphBudget {
  modules: number
  perPackage: number
}

export interface PackageCount {
  name: string
  count: number
}

export interface ComponentGraphReport {
  /** Total on-disk modules the bundler loaded for this component. */
  total: number
  overBudget: boolean
  /** Every owning npm package in the graph, by module count, descending. */
  packages: PackageCount[]
  /** Packages whose module count exceeds the per-package budget (barrels). */
  barrels: PackageCount[]
}

/**
 * The npm package that owns a module path — the segment(s) after the last
 * `node_modules/`, honoring an `@scope/name`. Null for first-party source (not in
 * `node_modules`), which is not attributed to any package.
 */
export function owningPackage(path: string): string | null {
  const marker = `${sep}node_modules${sep}`
  const idx = path.lastIndexOf(marker)
  if (idx === -1) return null
  const parts = path.slice(idx + marker.length).split(sep)
  const first = parts[0]
  if (!first) return null
  if (first.startsWith('@')) return parts[1] ? `${first}/${parts[1]}` : first
  return first
}

/**
 * Pure analysis of one component's real module-graph inputs against the budgets.
 * Groups inputs by owning package to surface a barrel; first-party source counts
 * toward the total but is attributed to no package.
 */
export function analyzeComponentGraph(
  inputs: string[],
  budget: GraphBudget,
): ComponentGraphReport {
  const counts = new Map<string, number>()
  for (const file of inputs) {
    const pkg = owningPackage(file)
    if (pkg) counts.set(pkg, (counts.get(pkg) ?? 0) + 1)
  }
  const packages = [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  return {
    total: inputs.length,
    overBudget: inputs.length > budget.modules,
    packages,
    barrels: packages.filter((p) => p.count > budget.perPackage),
  }
}

export interface GraphFinding {
  componentId: string
  file: string
  severity: 'error' | 'warning'
  message: string
}

export interface GraphCheckResult {
  /** One entry per measured component, for the per-component info line. */
  measured: { componentId: string; file: string; total: number }[]
  findings: GraphFinding[]
}

/** Resolve the effective budgets from config + the built-in defaults. */
export function resolveGraphBudget(partial?: {
  modules?: number
  perPackage?: number
}): GraphBudget {
  return {
    modules: partial?.modules ?? DEFAULT_GRAPH_BUDGET.modules,
    perPackage: partial?.perPackage ?? DEFAULT_GRAPH_BUDGET.perPackage,
  }
}

/**
 * Run the bundle-graph budget check over a package. Builds each component through
 * the crash-contained build worker, reads its real module graph, and produces
 * findings. A component whose isolated build *crashes the bundler* is a hard
 * error (attributed, never inherited as a native panic); over-budget and barrel
 * findings are warnings, escalated to errors under `strict`.
 */
export async function checkGraph(
  pkgDir: string,
  opts: { strict?: boolean } = {},
): Promise<GraphCheckResult> {
  const { config, configPath } = await resolveConfig(pkgDir)
  const budget = resolveGraphBudget(config.check?.graphBudget)
  const files = await discoverCaseFiles(pkgDir, config)
  const { modules } = await loadModules(files)
  const components = modules.map((m) => ({
    file: m.file,
    id: slugify(m.module.component),
  }))

  const sev = (): 'error' | 'warning' => (opts.strict ? 'error' : 'warning')
  const findings: GraphFinding[] = []
  const measured: GraphCheckResult['measured'] = []

  await Promise.all(
    components.map(async (c, i) => {
      const outcome = await spawnBuildWorker([
        'case',
        pkgDir,
        c.file,
        configPath,
        c.id,
        String(i),
      ])
      if (outcome.crashed) {
        findings.push({
          componentId: c.id,
          file: c.file,
          severity: 'error',
          message: `building this component crashed the bundler (${outcome.error}). This is a native bundler crash, not a logical build error, and has two known causes: a genuinely oversized module graph, or a Bun bundler bug (a use-after-free in the parallel chunk linker) that even a small graph can hit. If the graph is large, split the component's imports (e.g. avoid importing a whole barrel such as an entire icon set); otherwise treat it as a Bun bug and track it upstream. The same crash affects this component's dev /render and publish.`,
        })
        return
      }
      if (!outcome.ok) {
        // A logical build failure (e.g. an unresolved import) is surfaced by the
        // structure/ssr phases; here it just means the graph can't be measured.
        findings.push({
          componentId: c.id,
          file: c.file,
          severity: 'warning',
          message: `could not measure module graph (build failed): ${outcome.error}`,
        })
        return
      }
      const report = analyzeComponentGraph(outcome.inputs, budget)
      measured.push({ componentId: c.id, file: c.file, total: report.total })
      if (report.overBudget) {
        findings.push({
          componentId: c.id,
          file: c.file,
          severity: sev(),
          message: `module graph is ${report.total} modules, over the budget of ${budget.modules}. A graph this large risks destabilizing the bundler; split the component's imports.`,
        })
      }
      for (const barrel of report.barrels) {
        findings.push({
          componentId: c.id,
          file: c.file,
          severity: sev(),
          message: `dependency "${barrel.name}" contributes ${barrel.count} modules (over ${budget.perPackage}) — likely a whole-barrel import. Import only what the case uses (deep imports) instead of the package's index.`,
        })
      }
    }),
  )

  // Stable order: by component id, so the report is deterministic.
  measured.sort((a, b) => a.componentId.localeCompare(b.componentId))
  findings.sort(
    (a, b) =>
      a.componentId.localeCompare(b.componentId) ||
      a.message.localeCompare(b.message),
  )
  return { measured, findings }
}
