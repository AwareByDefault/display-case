import { dirname, join, relative, resolve } from 'node:path'
import { Glob } from 'bun'
import { slugify } from '../core/catalog'
import {
  discoverCaseFiles,
  loadModules,
  resolveConfig,
} from '../core/discovery'
import { makeGroupResolver } from '../core/groups'
import { segmentMdx } from '../core/mdx-lite'
import type {
  CaseModule,
  DisplayCaseConfig,
  HierarchyLevel,
  StructureRuleId,
  StructureRuleOptions,
  StructureSeverity,
} from '../index'
import { HIERARCHY_LEVELS } from '../index'
import { blankComments } from './check-text'

/**
 * Static "structure" best-practice checks for a Display-Case-ingested package.
 *
 * Browser-free and side-effect-free: every rule reads files, the resolved
 * config, and the loaded case modules — never a render or a server. The rules
 * fall into three groups (file/config, catalog-integrity, composition), each
 * independently disablable and severity-tunable via `config.check.structure`.
 * See `openspec/specs/display-case/spec.md` and the change's design.md.
 */

export interface StructureFinding {
  rule: StructureRuleId
  severity: StructureSeverity
  /** Absolute path of the file the finding is attributed to. */
  file: string
  message: string
}

export interface StructureCheckResult {
  findings: StructureFinding[]
}

/**
 * What a rule returns: a finding minus its severity (filled in from the rule's
 * resolved severity), unless the rule pins one itself — e.g. the scoped
 * "unresolved showcase import" notice is always a warning even under an
 * error-severity composition rule.
 */
type RuleFinding = Omit<StructureFinding, 'severity'> & {
  severity?: StructureSeverity
}

interface RuleDefault {
  enabled: boolean
  severity: StructureSeverity
}

/** Out-of-the-box enabled-state + severity for every rule. */
const RULE_DEFAULTS: Record<StructureRuleId, RuleDefault> = {
  'case-placard-coverage': { enabled: true, severity: 'error' },
  'no-orphaned-placard-doc': { enabled: true, severity: 'error' },
  'primer-present-and-used': { enabled: true, severity: 'error' },
  'setup-present': { enabled: true, severity: 'error' },
  'config-paths-exist': { enabled: true, severity: 'error' },
  'levels-classified': { enabled: true, severity: 'error' },
  'cases-load': { enabled: true, severity: 'error' },
  'flow-transitions-resolve': { enabled: true, severity: 'error' },
  'flow-multi-step': { enabled: true, severity: 'error' },
  'unique-slugs': { enabled: true, severity: 'error' },
  'tweak-defaults-valid': { enabled: true, severity: 'error' },
  'nav-groups-resolve': { enabled: true, severity: 'warn' },
  'interactive-cases-keyed': { enabled: true, severity: 'error' },
  'atom-purity': { enabled: false, severity: 'error' },
  'no-downward-dependency': { enabled: false, severity: 'error' },
  'composes-lower-level': { enabled: false, severity: 'warn' },
  'level-fit': { enabled: false, severity: 'warn' },
}

/** `level-fit` default per-level promotion thresholds (lower-level child count). */
const DEFAULT_THRESHOLDS: Partial<Record<HierarchyLevel, number>> = {
  molecule: 6,
  organism: 12,
}

interface ResolvedRule {
  enabled: boolean
  severity: StructureSeverity
  options: StructureRuleOptions
}

function resolveRule(
  id: StructureRuleId,
  config: DisplayCaseConfig,
): ResolvedRule {
  const def = RULE_DEFAULTS[id]
  const setting = config.check?.structure?.rules?.[id]
  if (setting === undefined) {
    return { enabled: def.enabled, severity: def.severity, options: {} }
  }
  if (setting === false) {
    return { enabled: false, severity: def.severity, options: {} }
  }
  if (setting === 'warn' || setting === 'error') {
    return { enabled: true, severity: setting, options: {} }
  }
  return {
    enabled: true,
    severity: setting.severity ?? def.severity,
    options: setting,
  }
}

const levelIndex = (l: HierarchyLevel | null): number =>
  l ? HIERARCHY_LEVELS.indexOf(l) : HIERARCHY_LEVELS.length

/** A `display-case: <token>` marker for any of the given tokens. */
function hasMarker(text: string, tokens: string[]): boolean {
  return tokens.some((t) =>
    new RegExp(`display-case:\\s*${t}(\\s|$)`).test(text),
  )
}

// ── Shared inputs ────────────────────────────────────────────────────────────

interface SharedInputs {
  pkgDir: string
  config: DisplayCaseConfig
  configPath: string
  caseFiles: string[]
  modules: { file: string; module: CaseModule }[]
  loadErrors: { file: string; error: string }[]
  /** Where the checks' own tooling resolves from (the display-case package). */
  toolingDir: string
}

// ── File / config rules ──────────────────────────────────────────────────────

/** Component-module globs implied by `*.case.tsx` roots (sibling `*.tsx`). */
function componentGlobs(config: DisplayCaseConfig): string[] {
  return config.roots
    .filter((r) => r.endsWith('.case.tsx'))
    .map((r) => r.replace(/\.case\.tsx$/, '.tsx'))
}

function isNonComponent(file: string): boolean {
  return (
    file.endsWith('.case.tsx') ||
    file.endsWith('.d.ts') ||
    file.endsWith('.test.tsx') ||
    file.endsWith('.test.ts')
  )
}

async function ruleCasePlacardCoverage(
  s: SharedInputs,
): Promise<Omit<StructureFinding, 'severity'>[]> {
  const out: Omit<StructureFinding, 'severity'>[] = []
  for (const pattern of componentGlobs(s.config)) {
    const glob = new Glob(pattern)
    for await (const file of glob.scan({ cwd: s.pkgDir, absolute: true })) {
      if (file.includes('/node_modules/') || isNonComponent(file)) continue
      const text = await Bun.file(file).text()
      // `no-case` declares a module non-showcasable (existing convention), so it
      // is fully exempt — a non-component needs neither a case nor a prompt.
      if (hasMarker(text, ['no-case', 'allow-case-placard-coverage'])) continue
      const base = file.replace(/\.tsx$/, '')
      const needsPrompt = !hasMarker(text, ['no-placard'])
      if (!(await Bun.file(`${base}.case.tsx`).exists())) {
        out.push({
          rule: 'case-placard-coverage',
          file,
          message:
            'missing colocated case file (expected a sibling *.case.tsx)',
        })
      }
      if (needsPrompt && !(await Bun.file(`${base}.placard.md`).exists())) {
        out.push({
          rule: 'case-placard-coverage',
          file,
          message:
            'missing colocated usage doc (expected a sibling *.placard.md)',
        })
      }
    }
  }
  return out
}

async function ruleNoOrphanedPlacardDoc(
  s: SharedInputs,
): Promise<Omit<StructureFinding, 'severity'>[]> {
  const out: Omit<StructureFinding, 'severity'>[] = []
  const placardGlobs = s.config.roots
    .filter((r) => r.endsWith('.case.tsx'))
    .map((r) => r.replace(/\.case\.tsx$/, '.placard.md'))
  const seen = new Set<string>()
  for (const pattern of placardGlobs) {
    const glob = new Glob(pattern)
    for await (const file of glob.scan({ cwd: s.pkgDir, absolute: true })) {
      if (file.includes('/node_modules/') || seen.has(file)) continue
      seen.add(file)
      const text = await Bun.file(file).text()
      if (hasMarker(text, ['allow-orphan', 'allow-no-orphaned-placard-doc'])) {
        continue
      }
      const casePath = file.replace(/\.placard\.md$/, '.case.tsx')
      if (!(await Bun.file(casePath).exists())) {
        out.push({
          rule: 'no-orphaned-placard-doc',
          file,
          message: 'orphaned usage doc (no sibling *.case.tsx)',
        })
      }
    }
  }
  return out
}

async function ruleConfigPathsExist(
  s: SharedInputs,
): Promise<Omit<StructureFinding, 'severity'>[]> {
  const out: Omit<StructureFinding, 'severity'>[] = []
  for (const rel of s.config.globalStyles ?? []) {
    if (!(await Bun.file(resolve(s.pkgDir, rel)).exists())) {
      out.push({
        rule: 'config-paths-exist',
        file: s.configPath,
        message: `globalStyles entry does not exist: ${rel}`,
      })
    }
  }
  if (s.config.baselineDir) {
    const dir = resolve(s.pkgDir, s.config.baselineDir)
    // A baseline dir may legitimately not exist yet (nothing recorded); only an
    // absolute/explicit path that resolves to a *file* is wrong. Skip silently
    // when absent — recording creates it — so this just guards a misconfigured
    // path that collides with a file.
    const f = Bun.file(dir)
    if ((await f.exists()) && (await f.stat()).isFile()) {
      out.push({
        rule: 'config-paths-exist',
        file: s.configPath,
        message: `baselineDir points at a file, not a directory: ${s.config.baselineDir}`,
      })
    }
  }
  return out
}

async function ruleSetupPresent(
  s: SharedInputs,
): Promise<Omit<StructureFinding, 'severity'>[]> {
  if (s.config.providers?.driver || s.config.providers?.diff) return []
  const required = ['playwright', '@axe-core/playwright', 'pixelmatch', 'pngjs']
  // The default backend resolves the toolchain relative to the display-case
  // package (see check.ts → providers/*), NOT the consumer. Probe both: the
  // setup is present if either the showcase or the checks' own tooling can
  // resolve it, so a consumer that gets the toolchain transitively via
  // display-case is not falsely flagged.
  const probeDirs = [s.pkgDir, s.toolingDir]
  const resolvable = (pkg: string): boolean =>
    probeDirs.some((dir) => {
      try {
        Bun.resolveSync(pkg, dir)
        return true
      } catch {
        return false
      }
    })
  const missing = required.filter((pkg) => !resolvable(pkg))
  if (missing.length === 0) return []
  return [
    {
      rule: 'setup-present',
      file: s.configPath,
      message:
        `render checks cannot run: missing ${missing.join(', ')}. Install the ` +
        'default toolchain (or run `display-case init --with-visual`), or set ' +
        '`providers.driver`/`providers.diff` in the config.',
    },
  ]
}

async function rulePrimerPresentAndUsed(
  s: SharedInputs,
): Promise<Omit<StructureFinding, 'severity'>[]> {
  const find = (message: string): Omit<StructureFinding, 'severity'>[] => [
    { rule: 'primer-present-and-used', file: s.configPath, message },
  ]
  if (!s.config.primer) return find('no primer is configured')
  const path = resolve(s.pkgDir, s.config.primer)
  if (!(await Bun.file(path).exists())) {
    return find(`configured primer does not exist: ${s.config.primer}`)
  }
  const text = await Bun.file(path).text()
  let blocks: ReturnType<typeof segmentMdx>
  try {
    blocks = segmentMdx(text)
  } catch (err) {
    return find(
      `could not parse primer: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
  // Count <Display> specimens across the document's block-level JSX, and confirm
  // the primer has at least one prose block alongside them.
  const displays = blocks
    .filter((b) => b.kind === 'jsx')
    .reduce((n, b) => n + b.tags.filter((t) => t === 'Display').length, 0)
  const hasContent = blocks.some((b) => b.kind === 'markdown')
  if (displays === 0) {
    return find('primer embeds no <Display> specimen')
  }
  if (!hasContent) {
    return find('primer has specimens but no prose content')
  }
  return []
}

// ── Catalog-integrity rules ──────────────────────────────────────────────────

function ruleCasesLoad(s: SharedInputs): Omit<StructureFinding, 'severity'>[] {
  return s.loadErrors.map((e) => ({
    rule: 'cases-load' as const,
    file: e.file,
    message: `case file failed to load: ${e.error}`,
  }))
}

async function ruleNavGroupsResolve(
  s: SharedInputs,
): Promise<Omit<StructureFinding, 'severity'>[]> {
  const groups = s.config.nav?.groups
  if (!groups) return []
  const refs = [
    ...(groups.order ?? []),
    ...Object.keys(groups.labels ?? {}),
    ...(groups.collapsed ?? []),
  ]
  if (refs.length === 0) return []

  // Collect every identifier a config reference could legitimately name: each
  // resolved group's full path (joined), every ancestor prefix of it, and every
  // individual segment — matching how the group tree keys nodes.
  const resolveGroup = makeGroupResolver(s.config)
  const valid = new Set<string>()
  for (const { file, module } of s.modules) {
    const mod =
      module.sourcePath != null
        ? module
        : { ...module, sourcePath: relative(s.pkgDir, file) }
    const acc: string[] = []
    for (const seg of resolveGroup(mod)) {
      acc.push(seg)
      valid.add(seg.toLowerCase())
      valid.add(acc.join('/').toLowerCase())
    }
  }

  const out: Omit<StructureFinding, 'severity'>[] = []
  const seen = new Set<string>()
  for (const ref of refs) {
    const key = ref.trim().toLowerCase()
    if (valid.has(key) || seen.has(key)) continue
    seen.add(key)
    out.push({
      rule: 'nav-groups-resolve',
      file: s.configPath,
      message: `nav config references group "${ref}" that no surface resolves to`,
    })
  }
  return out
}

async function ruleLevelsClassified(
  s: SharedInputs,
): Promise<Omit<StructureFinding, 'severity'>[]> {
  const out: Omit<StructureFinding, 'severity'>[] = []
  for (const { file, module } of s.modules) {
    if (module.level) continue
    const text = await Bun.file(file).text()
    if (hasMarker(text, ['unclassified', 'allow-levels-classified'])) continue
    out.push({
      rule: 'levels-classified',
      file,
      message: `component "${module.component}" declares no hierarchy level (unclassified)`,
    })
  }
  return out
}

function ruleFlowTransitionsResolve(
  s: SharedInputs,
): Omit<StructureFinding, 'severity'>[] {
  const out: Omit<StructureFinding, 'severity'>[] = []
  for (const { file, module } of s.modules) {
    if (!module.isFlow) continue
    const stepIds = new Set(Object.keys(module.cases).map(slugify))
    for (const [stepName, step] of Object.entries(module.cases)) {
      if (typeof step === 'function' || !('transitions' in step)) continue
      for (const target of step.transitions ?? []) {
        if (!stepIds.has(slugify(target))) {
          out.push({
            rule: 'flow-transitions-resolve',
            file,
            message: `flow "${module.component}" step "${stepName}" transitions to unknown step "${target}"`,
          })
        }
      }
    }
  }
  return out
}

function ruleFlowMultiStep(
  s: SharedInputs,
): Omit<StructureFinding, 'severity'>[] {
  const out: Omit<StructureFinding, 'severity'>[] = []
  for (const { file, module } of s.modules) {
    if (module.isFlow && Object.keys(module.cases).length <= 1) {
      out.push({
        rule: 'flow-multi-step',
        file,
        message: `flow "${module.component}" has ${Object.keys(module.cases).length} step(s); a flow needs more than one (use defineCases for a single state)`,
      })
    }
  }
  return out
}

function ruleUniqueSlugs(
  s: SharedInputs,
): Omit<StructureFinding, 'severity'>[] {
  const out: Omit<StructureFinding, 'severity'>[] = []
  const byComponentSlug = new Map<string, { file: string; name: string }[]>()
  for (const { file, module } of s.modules) {
    const slug = slugify(module.component)
    const arr = byComponentSlug.get(slug) ?? []
    arr.push({ file, name: module.component })
    byComponentSlug.set(slug, arr)
    // Case-slug collisions within this component.
    const caseSlugs = new Map<string, string[]>()
    for (const name of Object.keys(module.cases)) {
      const cs = slugify(name)
      const names = caseSlugs.get(cs) ?? []
      names.push(name)
      caseSlugs.set(cs, names)
    }
    for (const [cs, names] of caseSlugs) {
      if (names.length > 1) {
        out.push({
          rule: 'unique-slugs',
          file,
          message: `component "${module.component}" has cases colliding on slug "${cs}": ${names.join(', ')}`,
        })
      }
    }
  }
  for (const [slug, entries] of byComponentSlug) {
    if (entries.length > 1) {
      out.push({
        rule: 'unique-slugs',
        file: entries[0].file,
        message: `components collide on slug "${slug}": ${entries.map((e) => e.name).join(', ')}`,
      })
    }
  }
  return out
}

function ruleTweakDefaultsValid(
  s: SharedInputs,
): Omit<StructureFinding, 'severity'>[] {
  const out: Omit<StructureFinding, 'severity'>[] = []
  for (const { file, module } of s.modules) {
    for (const [caseName, c] of Object.entries(module.cases)) {
      const tweaks = typeof c === 'function' ? null : c.tweaks
      if (!tweaks) continue
      for (const [tweakName, t] of Object.entries(tweaks)) {
        if (t.kind === 'choice' && !t.options.includes(t.default as string)) {
          out.push({
            rule: 'tweak-defaults-valid',
            file,
            message: `${module.component} / ${caseName}: choice tweak "${tweakName}" default "${t.default}" is not one of its options`,
          })
        }
      }
    }
  }
  return out
}

// ── Case-content rules ───────────────────────────────────────────────────────

/**
 * Find the end of a JSX opening tag that starts at `from` (`<`), tolerating
 * `>` inside `{…}` attribute expressions (e.g. `onClick={() => a > b}`) and the
 * `>` of an arrow `=>`. Returns the index of the tag-closing `>`.
 */
function openingTagEnd(text: string, from: number): number {
  let depth = 0
  for (let i = from; i < text.length; i++) {
    const c = text[i]
    if (c === '{') depth++
    else if (c === '}') depth--
    else if (c === '>' && depth === 0 && text[i - 1] !== '=') return i
  }
  return text.length
}

/** Names of locally-defined components whose body calls a React state hook. */
function statefulLocalComponents(text: string): Set<string> {
  // Every local component definition and where it starts.
  const defs: { name: string; index: number }[] = []
  const defRe = /(?:function\s+([A-Z]\w*)|const\s+([A-Z]\w*)\s*=)/g
  for (let m = defRe.exec(text); m; m = defRe.exec(text)) {
    defs.push({ name: m[1] ?? m[2], index: m.index })
  }
  // Attribute each `useState`/`useReducer` to the closest preceding definition —
  // that component holds the state. (A pure helper in the same file is ignored.)
  const stateful = new Set<string>()
  const hookRe = /\buse(?:State|Reducer)\b/g
  for (let h = hookRe.exec(text); h; h = hookRe.exec(text)) {
    let owner: string | null = null
    for (const d of defs) {
      if (d.index < h.index) owner = d.name
      else break
    }
    if (owner) stateful.add(owner)
  }
  return stateful
}

/**
 * The browse chrome swaps cases *in place* — `root.render()` with no remount
 * (render-mount.tsx) — so a stateful specimen rendered at the same tree position
 * across cases keeps its `useState` value unless given a distinct `key`. Between
 * cases whose props differ (a different selected id, a disjoint option set) the
 * leaked state shows the wrong selection — or none at all — on switch. Flag a
 * locally-defined stateful specimen rendered in ≥2 cases where any usage omits a
 * `key`. (Single-use specimens always remount — the sibling case renders a
 * different element — so they are safe.)
 */
async function ruleInteractiveCasesKeyed(
  s: SharedInputs,
): Promise<RuleFinding[]> {
  const out: RuleFinding[] = []
  for (const file of s.caseFiles) {
    if (file.includes('/node_modules/')) continue
    const raw = await Bun.file(file).text()
    if (hasMarker(raw, ['allow-interactive-cases-keyed'])) continue
    // Scan with comments blanked (offsets preserved) so a `<Demo>` mentioned in
    // prose — like this rule's own guidance comment — is never miscounted.
    const text = blankComments(raw, false)
    const stateful = statefulLocalComponents(text)
    if (stateful.size === 0) continue
    // Only the case thunks (which follow `defineCases(`) render specimens; the
    // component definitions above it hold their own internal JSX, which is not a
    // per-case mount and must not be counted.
    const dc = text.search(/\bdefineCases\s*\(/)
    if (dc < 0) continue
    const region = text.slice(dc)
    for (const name of stateful) {
      const useRe = new RegExp(`<${name}(?![A-Za-z0-9_])`, 'g')
      let total = 0
      let unkeyed = 0
      for (let m = useRe.exec(region); m; m = useRe.exec(region)) {
        total++
        const tag = region.slice(m.index, openingTagEnd(region, m.index) + 1)
        if (!/\bkey\s*=/.test(tag)) unkeyed++
      }
      if (total >= 2 && unkeyed > 0) {
        out.push({
          rule: 'interactive-cases-keyed',
          file,
          message: `interactive specimen <${name}> is rendered in ${total} cases but ${unkeyed} omit a \`key\` — the browse chrome swaps cases in place (no remount), so React reuses <${name}>'s state across them, leaving a stale or empty selection on switch. Give each case's <${name}> a distinct \`key\` (see docs/writing-cases.md), or waive with a \`display-case: allow-interactive-cases-keyed\` comment.`,
        })
      }
    }
  }
  return out
}

// ── Composition (import-graph) rules ─────────────────────────────────────────

/** Map an absolute component-source path to its declared level (built per pkg). */
type LevelMap = Map<string, HierarchyLevel | null>

function buildLevelMap(modules: SharedInputs['modules']): LevelMap {
  const map: LevelMap = new Map()
  for (const { file, module } of modules) {
    map.set(file.replace(/\.case\.tsx$/, '.tsx'), module.level ?? null)
  }
  return map
}

interface ParsedImport {
  source: string
  names: string[]
  typeOnly: boolean
}

const IMPORT_RE = /import\s+(type\s+)?([\s\S]*?)\s+from\s*['"]([^'"]+)['"]/g

// Reused across files. Bun's transpiler resolves which imports are *real* —
// ignoring commented-out and string-literal imports, and dropping (erased)
// type-only ones — so a composition dependency can't be conjured by a comment.
const IMPORT_SCANNER = new Bun.Transpiler({ loader: 'tsx' })

/** The set of genuine runtime import paths Bun's parser sees, or null if the
 *  file has syntax the scanner rejects (then the regex stands alone). */
function realImportPaths(code: string): Set<string> | null {
  try {
    return new Set(
      IMPORT_SCANNER.scan(code)
        .imports.filter((i) => i.kind === 'import-statement')
        .map((i) => i.path),
    )
  } catch {
    // Bun's scanner throws on a few JSX shapes (e.g. `key` after a spread). Fall
    // back to the regex alone rather than dropping the file's imports entirely.
    return null
  }
}

/** Parse import statements for source + named bindings (skips bare side-effect
 *  imports). Bun's transpiler supplies the authoritative set of real imports; the
 *  regex contributes the named bindings it doesn't expose. */
function parseImports(code: string): ParsedImport[] {
  const real = realImportPaths(code)
  const out: ParsedImport[] = []
  IMPORT_RE.lastIndex = 0
  for (let m = IMPORT_RE.exec(code); m; m = IMPORT_RE.exec(code)) {
    const typeOnly = Boolean(m[1])
    const clause = m[2]
    const source = m[3]
    // When the scanner ran, trust it: keep only statements it confirmed are real
    // runtime imports (this drops type-only, commented, and string-literal
    // matches). When it threw, `real` is null and every regex match is kept.
    if (real && !real.has(source)) continue
    const names: string[] = []
    const braced = clause.match(/\{([^}]*)\}/)
    if (braced) {
      for (const part of braced[1].split(',')) {
        const name = part
          .trim()
          .split(/\s+as\s+/)[0]
          .trim()
        if (name && name !== 'type') names.push(name)
      }
    }
    out.push({ source, names, typeOnly })
  }
  return out
}

const RESOLVE_EXTS = ['.tsx', '.ts', '.jsx', '.js']
function candidatePaths(base: string): string[] {
  return [
    base,
    ...RESOLVE_EXTS.map((e) => base + e),
    ...RESOLVE_EXTS.map((e) => join(base, `index${e}`)),
  ]
}

/** Foreign workspace showcase catalog, cached per package root. */
interface ForeignShowcase {
  pkgDir: string
  levelMap: LevelMap
  /** Re-export name → absolute target file (best-effort, common barrel form). */
  reexports: Map<string, string>
}

const foreignCache = new Map<string, ForeignShowcase | null>()

async function loadForeignShowcase(
  pkgDir: string,
): Promise<ForeignShowcase | null> {
  if (foreignCache.has(pkgDir)) return foreignCache.get(pkgDir) ?? null
  let result: ForeignShowcase | null = null
  try {
    const hasConfig =
      (await Bun.file(join(pkgDir, 'display-case.config.ts')).exists()) ||
      (await Bun.file(join(pkgDir, 'display-case.config.tsx')).exists())
    if (hasConfig) {
      const { config } = await resolveConfig(pkgDir)
      const files = await discoverCaseFiles(pkgDir, config)
      const { modules } = await loadModules(files)
      const levelMap = buildLevelMap(
        modules.map((m) => ({ file: m.file, module: m.module })),
      )
      result = { pkgDir, levelMap, reexports: new Map() }
    }
  } catch {
    result = null
  }
  foreignCache.set(pkgDir, result)
  return result
}

const REEXPORT_RE = /export\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g

/** Resolve a named re-export through a barrel entry to a target component file. */
async function followReexport(
  entryFile: string,
  name: string,
): Promise<string | null> {
  let text: string
  try {
    text = await Bun.file(entryFile).text()
  } catch {
    return null
  }
  REEXPORT_RE.lastIndex = 0
  for (let m = REEXPORT_RE.exec(text); m; m = REEXPORT_RE.exec(text)) {
    const exported = m[1].split(',').map((p) =>
      p
        .trim()
        .split(/\s+as\s+/)
        .pop()
        ?.trim(),
    )
    if (!exported.includes(name)) continue
    for (const cand of candidatePaths(resolve(dirname(entryFile), m[2]))) {
      if (await Bun.file(cand).exists()) return cand
    }
  }
  return null
}

interface DepResolution {
  /** Levels of resolved showcased components this import contributes. */
  levels: (HierarchyLevel | null)[]
  /** True when it looked like a workspace showcase import but couldn't resolve. */
  unresolvedShowcase: boolean
}

async function resolveDependency(
  imp: ParsedImport,
  fromFile: string,
  pkgDir: string,
  levelMap: LevelMap,
): Promise<DepResolution> {
  const res: DepResolution = { levels: [], unresolvedShowcase: false }
  if (imp.typeOnly) return res

  // Relative import: resolve straight to a component file.
  if (imp.source.startsWith('.')) {
    const base = resolve(dirname(fromFile), imp.source)
    for (const cand of candidatePaths(base)) {
      if (levelMap.has(cand)) {
        res.levels.push(levelMap.get(cand) ?? null)
        return res
      }
    }
    return res
  }

  // Bare specifier: cross-package. Only workspace showcases expose levels.
  let entry: string
  try {
    entry = Bun.resolveSync(imp.source, pkgDir)
  } catch {
    return res
  }
  // Walk up from the resolved entry to a package root holding a showcase config.
  let dir = dirname(entry)
  let foreign: ForeignShowcase | null = null
  for (let i = 0; i < 12; i++) {
    if (await Bun.file(join(dir, 'package.json')).exists()) {
      foreign = await loadForeignShowcase(dir)
      break
    }
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  if (!foreign) return res
  for (const name of imp.names) {
    const target = await followReexport(entry, name)
    if (target && foreign.levelMap.has(target)) {
      res.levels.push(foreign.levelMap.get(target) ?? null)
    } else {
      res.unresolvedShowcase = true
    }
  }
  return res
}

interface CompositionContext {
  s: SharedInputs
  levelMap: LevelMap
}

/** Per-component resolved dependency levels (shared across composition rules). */
async function resolveComponentDeps(ctx: CompositionContext): Promise<
  {
    file: string
    module: CaseModule
    depLevels: (HierarchyLevel | null)[]
    unresolvedShowcase: boolean
  }[]
> {
  const out = []
  for (const { file, module } of ctx.s.modules) {
    if (module.isFlow || !module.level) continue
    const compFile = file.replace(/\.case\.tsx$/, '.tsx')
    if (!(await Bun.file(compFile).exists())) continue
    const code = await Bun.file(compFile).text()
    const imports = parseImports(code)
    const depLevels: (HierarchyLevel | null)[] = []
    let unresolvedShowcase = false
    for (const imp of imports) {
      const dep = await resolveDependency(
        imp,
        compFile,
        ctx.s.pkgDir,
        ctx.levelMap,
      )
      depLevels.push(...dep.levels)
      if (dep.unresolvedShowcase) unresolvedShowcase = true
    }
    out.push({ file: compFile, module, depLevels, unresolvedShowcase })
  }
  return out
}

function markerExempt(code: string, id: StructureRuleId): boolean {
  return hasMarker(code, [`allow-${id}`])
}

async function ruleAtomPurity(ctx: CompositionContext): Promise<RuleFinding[]> {
  const out: RuleFinding[] = []
  const deps = await resolveComponentDeps(ctx)
  for (const d of deps) {
    if (d.module.level !== 'atom') continue
    const code = await Bun.file(d.file).text()
    if (markerExempt(code, 'atom-purity')) continue
    if (d.depLevels.length > 0) {
      out.push({
        rule: 'atom-purity',
        file: d.file,
        message: `atom "${d.module.component}" imports ${d.depLevels.length} other showcased component(s); atoms must be leaves`,
      })
    }
    if (d.unresolvedShowcase) {
      out.push({
        rule: 'atom-purity',
        severity: 'warn',
        file: d.file,
        message: `atom "${d.module.component}" imports a workspace showcase component that could not be resolved (skipped)`,
      })
    }
  }
  return out
}

async function ruleNoDownwardDependency(
  ctx: CompositionContext,
): Promise<RuleFinding[]> {
  const out: RuleFinding[] = []
  const deps = await resolveComponentDeps(ctx)
  for (const d of deps) {
    const own = levelIndex(d.module.level ?? null)
    const code = await Bun.file(d.file).text()
    if (markerExempt(code, 'no-downward-dependency')) continue
    for (const dl of d.depLevels) {
      if (levelIndex(dl) > own) {
        out.push({
          rule: 'no-downward-dependency',
          file: d.file,
          message: `${d.module.level} "${d.module.component}" imports a higher-level (${dl}) component; composition must flow upward`,
        })
      }
    }
    if (d.unresolvedShowcase) {
      out.push({
        rule: 'no-downward-dependency',
        severity: 'warn',
        file: d.file,
        message: `"${d.module.component}" imports a workspace showcase component that could not be resolved (skipped)`,
      })
    }
  }
  return out
}

async function ruleComposesLowerLevel(
  ctx: CompositionContext,
): Promise<RuleFinding[]> {
  const out: RuleFinding[] = []
  const deps = await resolveComponentDeps(ctx)
  for (const d of deps) {
    if (d.module.level === 'atom') continue
    const own = levelIndex(d.module.level ?? null)
    const code = await Bun.file(d.file).text()
    if (markerExempt(code, 'composes-lower-level')) continue
    const hasLower = d.depLevels.some((dl) => levelIndex(dl) < own)
    if (hasLower) continue
    if (d.unresolvedShowcase) {
      // Can't confirm composition through an unfollowable workspace import — warn
      // rather than assert the component composes nothing lower.
      out.push({
        rule: 'composes-lower-level',
        severity: 'warn',
        file: d.file,
        message: `${d.module.level} "${d.module.component}" imports a workspace showcase component that could not be resolved; cannot confirm lower-level composition`,
      })
    } else {
      out.push({
        rule: 'composes-lower-level',
        file: d.file,
        message: `${d.module.level} "${d.module.component}" composes no lower-level showcased component`,
      })
    }
  }
  return out
}

async function ruleLevelFit(
  ctx: CompositionContext,
  options: StructureRuleOptions,
): Promise<Omit<StructureFinding, 'severity'>[]> {
  const out: Omit<StructureFinding, 'severity'>[] = []
  const thresholds = { ...DEFAULT_THRESHOLDS, ...(options.thresholds ?? {}) }
  const deps = await resolveComponentDeps(ctx)
  for (const d of deps) {
    const level = d.module.level
    if (!level) continue
    const threshold = thresholds[level]
    if (threshold === undefined) continue
    const code = await Bun.file(d.file).text()
    if (markerExempt(code, 'level-fit')) continue
    const own = levelIndex(level)
    const lower = d.depLevels.filter((dl) => levelIndex(dl) < own).length
    if (lower > threshold) {
      out.push({
        rule: 'level-fit',
        file: d.file,
        message: `${level} "${d.module.component}" composes ${lower} lower-level components (> ${threshold}); consider promoting it`,
      })
    }
  }
  return out
}

// ── Orchestrator ─────────────────────────────────────────────────────────────

function matchesIgnore(
  file: string,
  pkgDir: string,
  globs: string[] | undefined,
): boolean {
  if (!globs?.length) return false
  const rel = relative(pkgDir, file)
  return globs.some((g) => new Glob(g).match(rel))
}

export interface StructureOptions {
  /** Treat all warnings as errors (CLI `--strict`). Merged with config.check.structure.strict. */
  strict?: boolean
  /**
   * Directory the checks' own tooling resolves from, for `setup-present`'s
   * second probe. Defaults to the display-case package (where the visual backend
   * actually resolves the toolchain). Overridable for tests.
   */
  toolingDir?: string
}

export async function checkStructure(
  pkgDir: string,
  opts: StructureOptions = {},
): Promise<StructureCheckResult> {
  const { config, configPath } = await resolveConfig(pkgDir)
  const caseFiles = await discoverCaseFiles(pkgDir, config)
  const { modules, errors } = await loadModules(caseFiles)
  const shared: SharedInputs = {
    pkgDir,
    config,
    configPath,
    caseFiles,
    modules: modules.map((m) => ({ file: m.file, module: m.module })),
    loadErrors: errors,
    // import.meta.dir is the display-case package's src — the same resolution
    // scope the visual backend (providers/*) loads the toolchain from.
    toolingDir: opts.toolingDir ?? resolve(import.meta.dir, '..'),
  }
  const levelMap = buildLevelMap(shared.modules)
  const ctx: CompositionContext = { s: shared, levelMap }

  // Each entry: rule id → produce its (severity-less) findings.
  const runners: Record<
    StructureRuleId,
    (o: StructureRuleOptions) => RuleFinding[] | Promise<RuleFinding[]>
  > = {
    'case-placard-coverage': () => ruleCasePlacardCoverage(shared),
    'no-orphaned-placard-doc': () => ruleNoOrphanedPlacardDoc(shared),
    'primer-present-and-used': () => rulePrimerPresentAndUsed(shared),
    'setup-present': () => ruleSetupPresent(shared),
    'config-paths-exist': () => ruleConfigPathsExist(shared),
    'levels-classified': () => ruleLevelsClassified(shared),
    'cases-load': () => ruleCasesLoad(shared),
    'flow-transitions-resolve': () => ruleFlowTransitionsResolve(shared),
    'flow-multi-step': () => ruleFlowMultiStep(shared),
    'unique-slugs': () => ruleUniqueSlugs(shared),
    'tweak-defaults-valid': () => ruleTweakDefaultsValid(shared),
    'nav-groups-resolve': () => ruleNavGroupsResolve(shared),
    'interactive-cases-keyed': () => ruleInteractiveCasesKeyed(shared),
    'atom-purity': () => ruleAtomPurity(ctx),
    'no-downward-dependency': () => ruleNoDownwardDependency(ctx),
    'composes-lower-level': () => ruleComposesLowerLevel(ctx),
    'level-fit': (o) => ruleLevelFit(ctx, o),
  }

  const ids = Object.keys(runners) as StructureRuleId[]
  const perRule = await Promise.all(
    ids.map(async (id) => {
      const rule = resolveRule(id, config)
      if (!rule.enabled) return [] as StructureFinding[]
      const raw = await runners[id](rule.options)
      return raw
        .filter((f) => !matchesIgnore(f.file, pkgDir, rule.options.ignore))
        .map((f) => ({ ...f, severity: f.severity ?? rule.severity }))
    }),
  )

  const strict = opts.strict || config.check?.structure?.strict
  const findings = perRule
    .flat()
    .map((f) => (strict ? { ...f, severity: 'error' as const } : f))
    .sort(
      (a, b) => a.file.localeCompare(b.file) || a.rule.localeCompare(b.rule),
    )

  return { findings }
}
