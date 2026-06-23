import type {
  Case,
  CaseModule,
  FlowStep,
  HierarchyLevel,
  TweakSchema,
} from '../index'
import { HIERARCHY_LEVELS } from '../index'

/**
 * Pure catalog model shared by the server (to build the manifest) and the
 * browser (to resolve a slug back to a case). No node/DOM-specific imports.
 */

export interface CatalogCase {
  id: string
  name: string
  /** Declared tweak schema, or null when the case takes no tweaks. */
  tweaks: TweakSchema | null
  /** Slugified ids of steps this step can transition to (flows only; else []). */
  transitions: string[]
}

export interface CatalogComponent {
  id: string
  name: string
  level: HierarchyLevel | null
  isFlow: boolean
  /** Resolved information-architecture group path (Exhibits mode); `[]` by
   *  default and for building-block components. Computed by the injected
   *  resolver (see `buildCatalog`), so the pure catalog stays config-free. */
  group: string[]
  cases: CatalogCase[]
}

/** Kebab-case a display name into a stable, URL-safe slug. */
export function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function caseTweaks(c: Case | FlowStep): TweakSchema | null {
  return typeof c === 'function' ? null : (c.tweaks ?? null)
}

/** Outgoing transitions of a flow step, as slugified target ids. */
function caseTransitions(c: Case | FlowStep): string[] {
  if (typeof c === 'function' || !('transitions' in c) || !c.transitions) {
    return []
  }
  return c.transitions.map(slugify)
}

/**
 * Build the ordered catalog from discovered case modules. `resolveGroup` maps a
 * module to its information-architecture group path (default: none); the server
 * passes a config-bound resolver, while browser callers (slug resolution) omit
 * it so the catalog stays config-free.
 */
export function buildCatalog(
  modules: CaseModule[],
  resolveGroup: (mod: CaseModule) => string[] = () => [],
): CatalogComponent[] {
  const components = modules.map((mod) => ({
    id: slugify(mod.component),
    name: mod.component,
    level: mod.level ?? null,
    isFlow: mod.isFlow,
    group: resolveGroup(mod),
    cases: Object.entries(mod.cases).map(([name, c]) => ({
      id: slugify(name),
      name,
      tweaks: caseTweaks(c),
      transitions: caseTransitions(c),
    })),
  }))
  // Stable sort: by hierarchy level (atoms first, unclassified last), then name.
  return components.sort((a, b) => {
    const la = a.level
      ? HIERARCHY_LEVELS.indexOf(a.level)
      : HIERARCHY_LEVELS.length
    const lb = b.level
      ? HIERARCHY_LEVELS.indexOf(b.level)
      : HIERARCHY_LEVELS.length
    return la - lb || a.name.localeCompare(b.name)
  })
}

/** Resolve a component+case slug pair back to its module and renderable case. */
export function findCase(
  modules: CaseModule[],
  componentId: string,
  caseId: string,
): { module: CaseModule; caseName: string; case: Case | FlowStep } | null {
  const mod = modules.find((m) => slugify(m.component) === componentId)
  if (!mod) return null
  const entry = Object.entries(mod.cases).find(
    ([name]) => slugify(name) === caseId,
  )
  if (!entry) return null
  return { module: mod, caseName: entry[0], case: entry[1] }
}
