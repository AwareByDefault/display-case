import { mkdir } from 'node:fs/promises'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'
import { Glob } from 'bun'
import { componentClosures } from '../core/affected'
import { baselineDir, cacheDir, resolveConfig } from '../core/discovery'
import type { ManifestComponent } from '../core/manifest'
import type {
  A11yViolation,
  CaseContext,
  DiffFn,
  DisplayCaseConfig,
  RenderDriver,
} from '../index'
import { startDisplayCase } from '../server/server'
import {
  emptyTally,
  type PhaseTally,
  summaryLines,
  testLine,
} from './check-reporter'
import { checkGraph } from './graph-check'
import { checkSsr } from './ssr-check'
import { checkStructure } from './structure-check'
import { checkTokens } from './tokens-check'

/**
 * Headless a11y + visual-regression runner. The capture/audit driver and the
 * image diff are pluggable (config `providers`); when unset, the built-in
 * Playwright/axe + pixelmatch/pngjs defaults are imported lazily — so those
 * packages are needed only when a default-backed check actually runs.
 */

const THEMES = ['light', 'dark'] as const
const VIEWPORT_WIDTH = 1024

const INSTALL_HINT =
  'Visual/a11y checks need the default toolchain. Install it with ' +
  '`bun add -d playwright @axe-core/playwright pixelmatch pngjs && bunx playwright install chromium` ' +
  '(or run `display-case init --with-visual`), or set `providers.driver`/`providers.diff` in display-case.config.ts.'

export interface CheckOptions {
  a11y: boolean
  visual: boolean
  tokens: boolean
  structure: boolean
  /** Server-render every case and fail on any that can't pre-render. */
  ssr: boolean
  /** Measure each component's real bundled module graph and warn on an
   *  over-budget graph or a barrel import (builds each component in isolation). */
  graph: boolean
  update: boolean
  /** Treat structure (and graph) warnings as errors (CLI `--strict`). */
  strict?: boolean
  /** Restrict the render phases (a11y/visual) to these component ids or globs. */
  only?: string[]
  /** Restrict the render phases to components whose import closure touches a
   *  file changed since this git ref (CLI `--changed[=ref]`). */
  changedRef?: string
  /** How many variants the render phases (a11y/visual) scan concurrently.
   *  CLI `--concurrency=N`; defaults to {@link DEFAULT_CONCURRENCY}. */
  concurrency?: number
  port?: number
}

/** Default render-phase concurrency — modest, so a stock laptop isn't swamped by
 *  parallel headless pages while still cutting wall-clock well below serial. */
const DEFAULT_CONCURRENCY = 4

/**
 * Run `worker` over `items` with at most `limit` in flight at once. Drives the
 * a11y/visual phases: the browser work is I/O-bound, so concurrent pages overlap
 * almost entirely. JS stays single-threaded, so the shared counters/arrays the
 * workers mutate need no locking — only one worker runs between any two awaits.
 */
async function mapPool<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0
  const lanes = Array.from(
    { length: Math.max(1, Math.min(limit, items.length)) },
    async () => {
      while (true) {
        const i = next++
        if (i >= items.length) return
        await worker(items[i])
      }
    },
  )
  await Promise.all(lanes)
}

interface Target {
  componentId: string
  caseId: string
  theme: (typeof THEMES)[number]
  renderUrl: string
}

/** One scanned variant in the written a11y report (only failing variants). */
interface A11yReportEntry {
  component: string
  case: string
  theme: string
  violations: A11yViolation[]
}

/** Cap on per-violation detail lines printed inline; the full set is always in
 *  the written report. Keeps a noisy run's console readable. */
const A11Y_DETAIL_CAP = 8

/**
 * Indented, human-readable detail lines for one violation: the failing element
 * and, for colour-contrast, the exact measured pair and threshold — the data
 * that makes a finding fixable without re-running a browser. Pure (no I/O) so
 * the formatting is unit-tested.
 */
export function a11yDetailLines(v: A11yViolation): string[] {
  const details = v.details ?? []
  const lines = details.slice(0, A11Y_DETAIL_CAP).map((d) => {
    const where = d.target || '(element)'
    if (d.contrast) {
      const c = d.contrast
      const font = c.fontSize
        ? `  [${c.fontSize}${c.fontWeight ? ` ${c.fontWeight}` : ''}]`
        : ''
      return `      ↳ ${where}  ${c.foreground} on ${c.background} = ${c.ratio}:1 (need ${c.required}:1)${font}`
    }
    const why = (d.failureSummary ?? '').split('\n')[0].trim()
    return `      ↳ ${where}${why ? `  ${why}` : ''}`
  })
  if (details.length > A11Y_DETAIL_CAP) {
    lines.push(`      ↳ … +${details.length - A11Y_DETAIL_CAP} more node(s)`)
  }
  return lines
}

async function resolveDriver(config: DisplayCaseConfig): Promise<RenderDriver> {
  if (config.providers?.driver) return await config.providers.driver()
  try {
    const { createPlaywrightDriver } = await import(
      './providers/playwright-driver'
    )
    return await createPlaywrightDriver()
  } catch (err) {
    throw new Error(
      `${INSTALL_HINT}\n  (${err instanceof Error ? err.message : String(err)})`,
    )
  }
}

async function resolveDiff(config: DisplayCaseConfig): Promise<DiffFn> {
  if (config.providers?.diff) return config.providers.diff
  try {
    const { pixelmatchDiff } = await import('./providers/pixelmatch-diff')
    return pixelmatchDiff
  } catch (err) {
    throw new Error(
      `${INSTALL_HINT}\n  (${err instanceof Error ? err.message : String(err)})`,
    )
  }
}

/**
 * Absolute paths of files changed since `ref`, for `--changed` scoping. Unions
 * the committed diff since the merge-base (`ref...HEAD`) with the working tree
 * (`HEAD`), so a local run also sees staged/unstaged edits and CI sees the PR's
 * commits. Returns an empty list when git is unavailable or `ref` can't be
 * resolved (e.g. an over-shallow clone) — the caller treats "no changes" as
 * "nothing affected".
 */
async function changedSince(pkgDir: string, ref: string): Promise<string[]> {
  const top = await Bun.$`git -C ${pkgDir} rev-parse --show-toplevel`
    .quiet()
    .nothrow()
  if (top.exitCode !== 0) return []
  const root = top.stdout.toString().trim()
  const names = new Set<string>()
  for (const range of [`${ref}...HEAD`, 'HEAD']) {
    const out = await Bun.$`git -C ${root} diff --name-only ${range}`
      .quiet()
      .nothrow()
    if (out.exitCode !== 0) continue
    for (const line of out.stdout.toString().split('\n')) {
      if (line.trim()) names.add(resolve(root, line.trim()))
    }
  }
  return [...names]
}

// Extensions whose change can alter a rendered case (markup, behaviour, style).
const RENDER_EXTS = new Set(['.tsx', '.ts', '.jsx', '.js', '.css', '.mdx'])
// Trees under the package that never feed a render (so a change there scopes to
// nothing): docs, specs, the e2e suite, agent skills, build/CI tooling.
const NON_RENDER_DIRS =
  /^(\.github|\.claude|contributing|docs|e2e|skills|scripts|tools|node_modules)(\/|$)/

/** Whether a changed file (absolute) can affect a rendered case. */
function isRenderRelevant(file: string, pkgRoot: string): boolean {
  if (file !== pkgRoot && !file.startsWith(pkgRoot + sep)) return false
  const rel = relative(pkgRoot, file)
  if (NON_RENDER_DIRS.test(rel)) return false
  if (/\.(test|spec)\.[tj]sx?$/.test(rel) || /\.test-d\.ts$/.test(rel))
    return false
  if (rel.endsWith('.d.ts')) return false
  return RENDER_EXTS.has(extname(file))
}

/**
 * The components affected by the changes since `ref`. Render-irrelevant changes
 * (docs, specs, tests, tooling) scope to nothing. A render-relevant change is
 * attributed to a component when it lies in that component's import closure; a
 * render-relevant change that *no* closure claims — globally-inlined component
 * CSS, the render pipeline, shared source — conservatively affects every
 * component, so a regression is never silently skipped.
 */
async function changedScope(
  pkgDir: string,
  ref: string,
  comps: { id: string; caseFile: string }[],
): Promise<Set<string>> {
  const pkgRoot = resolve(pkgDir)
  const changed = (await changedSince(pkgDir, ref)).filter((f) =>
    isRenderRelevant(f, pkgRoot),
  )
  if (changed.length === 0) return new Set()
  const closures = await componentClosures(comps)
  const claimed = new Set<string>()
  for (const files of closures.values()) for (const f of files) claimed.add(f)
  // Any render-relevant change outside every closure ⇒ a global input changed.
  if (changed.some((f) => !claimed.has(f))) {
    return new Set(comps.map((c) => c.id))
  }
  const changedSet = new Set(changed)
  const affected = new Set<string>()
  for (const [id, files] of closures) {
    for (const f of files) {
      if (changedSet.has(f)) {
        affected.add(id)
        break
      }
    }
  }
  return affected
}

export async function runChecks(
  pkgDir: string,
  opts: CheckOptions,
): Promise<boolean> {
  const { config } = await resolveConfig(pkgDir)
  const baselines = baselineDir(pkgDir, config)

  // Token conformance is a static parse — run it first, with no browser/server.
  let tokenViolations = 0
  if (opts.tokens) {
    const { violations } = await checkTokens(pkgDir)
    tokenViolations = violations.length
    for (const v of violations) {
      const rel = v.file.startsWith(`${pkgDir}/`)
        ? v.file.slice(pkgDir.length + 1)
        : v.file
      console.error(
        `  tokens ✗ ${rel}:${v.line}:${v.column} unknown token ${v.token}${v.hadFallback ? ' (fallback does not excuse it)' : ''}`,
      )
    }
  }

  // Structure best-practice checks are also static — no browser/server.
  let structureErrors = 0
  let structureWarnings = 0
  if (opts.structure) {
    const { findings } = await checkStructure(pkgDir, { strict: opts.strict })
    for (const f of findings) {
      const rel = f.file.startsWith(`${pkgDir}/`)
        ? f.file.slice(pkgDir.length + 1)
        : f.file
      const line = `  structure ${f.severity === 'error' ? '✗' : '⚠'} ${rel}: ${f.message} (${f.rule})`
      if (f.severity === 'error') {
        structureErrors++
        console.error(line)
      } else {
        structureWarnings++
        console.warn(line)
      }
    }
  }

  // SSR-safety is a static check too: render every case with `renderToString`
  // (no browser, no server) and flag any that can't pre-render — a case that
  // touches a browser-only API during render. Declared-`browserOnly` components
  // are expected and skipped.
  let ssrErrors = 0
  if (opts.ssr) {
    const { findings, declared } = await checkSsr(pkgDir)
    for (const f of findings) {
      ssrErrors++
      const rel = f.file.startsWith(`${pkgDir}/`)
        ? f.file.slice(pkgDir.length + 1)
        : f.file
      console.error(
        `  ssr ✗ ${rel}: ${f.component}/${f.case} can't render before scripts (${f.error}). ` +
          'Move browser APIs into effects/handlers, or declare the component browserOnly.',
      )
    }
    if (declared)
      console.log(`  ssr: ${declared} case(s) declared browser-only`)
  }

  // Bundle-graph budget: build each component in isolation (crash-contained) and
  // measure its real module graph, warning on an over-budget graph or a barrel
  // import. Heavier than the other static phases (it builds every component), so
  // it is opt-in to a full run, not part of the slim `--structure --tokens --ssr`
  // gate. A component whose build crashes the bundler is a hard error here.
  let graphErrors = 0
  let graphWarnings = 0
  if (opts.graph) {
    const { measured, findings } = await checkGraph(pkgDir, {
      strict: opts.strict,
    })
    for (const m of measured) {
      console.log(`  graph: ${m.componentId} — ${m.total} module(s)`)
    }
    for (const f of findings) {
      const line = `  graph ${f.severity === 'error' ? '✗' : '⚠'} ${f.componentId}: ${f.message}`
      if (f.severity === 'error') {
        graphErrors++
        console.error(line)
      } else {
        graphWarnings++
        console.warn(line)
      }
    }
  }

  const staticErrors =
    tokenViolations + structureErrors + ssrErrors + graphErrors
  const staticWarnings = structureWarnings + graphWarnings

  // The browser phases (a11y + visual) are the only ones needing a live render.
  if (!opts.a11y && !opts.visual) {
    const ok = staticErrors === 0
    const warn = staticWarnings ? `, ${staticWarnings} warning(s)` : ''
    console.log(
      ok
        ? `\n  ✓ checks passed${warn}`
        : `\n  ✗ ${tokenViolations} token violation(s), ${structureErrors} structure error(s), ${ssrErrors} ssr error(s), ${graphErrors} graph error(s)${warn}`,
    )
    return ok
  }

  const server = await startDisplayCase(pkgDir, { port: opts.port ?? 0 })
  const base = String(server.url).replace(/\/$/, '')
  const manifest = await fetch(`${base}/manifest.json`).then((r) => r.json())

  // Resolve the change-scope for the render phases. `null` means no scoping —
  // every component is checked (the default). Otherwise it is the set of
  // component ids to check; an empty set short-circuits before any browser work.
  let scope: Set<string> | null = null
  if (opts.only || opts.changedRef) {
    const comps = (manifest.components as ManifestComponent[]).map((c) => ({
      id: c.id,
      caseFile: resolve(pkgDir, c.caseFile),
    }))
    const sets: Set<string>[] = []
    if (opts.only) {
      const globs = opts.only.map((g) => new Glob(g))
      sets.push(
        new Set(
          comps
            .filter((c) => globs.some((g) => g.match(c.id)))
            .map((c) => c.id),
        ),
      )
    }
    if (opts.changedRef) {
      sets.push(await changedScope(pkgDir, opts.changedRef, comps))
    }
    // Both flags present ⇒ a component must satisfy both (intersection).
    scope = sets[0]
    for (const s of sets.slice(1)) {
      const next = new Set<string>()
      for (const id of scope) if (s.has(id)) next.add(id)
      scope = next
    }
    const basis = [
      opts.only ? '--only' : null,
      opts.changedRef ? `--changed=${opts.changedRef}` : null,
    ]
      .filter(Boolean)
      .join(' + ')
    console.log(
      `  scope: ${scope.size} of ${comps.length} component(s) (${basis})`,
    )
    if (scope.size === 0) {
      server.stop(true)
      const ok = staticErrors === 0
      const warn = staticWarnings ? `, ${staticWarnings} warning(s)` : ''
      console.log(
        ok
          ? `\n  ✓ checks passed — no affected components${warn}`
          : `\n  ✗ ${tokenViolations} token violation(s), ${structureErrors} structure error(s), ${ssrErrors} ssr error(s), ${graphErrors} graph error(s)${warn}`,
      )
      return ok
    }
  }

  const targets: Target[] = []
  for (const c of manifest.components) {
    if (scope && !scope.has(c.id)) continue
    for (const cs of c.cases) {
      for (const theme of THEMES) {
        targets.push({
          componentId: c.id,
          caseId: cs.id,
          theme,
          renderUrl: `${base}${cs.renderUrl}?theme=${theme}`,
        })
      }
    }
  }

  // Shared scan parameters (also honored by the live in-app surface) so the
  // panel and this gate agree on what counts as a violation. `enabled` is NOT
  // consulted here — the gate runs whenever invoked.
  const a11yThemes = config.a11y?.themes ?? THEMES
  const a11yExclude = config.a11y?.exclude

  const driver = await resolveDriver(config)
  const diff = opts.visual ? await resolveDiff(config) : null
  const requested =
    opts.concurrency ?? config.check?.concurrency ?? DEFAULT_CONCURRENCY
  const concurrency =
    Number.isFinite(requested) && requested > 0
      ? Math.floor(requested)
      : DEFAULT_CONCURRENCY

  let a11yViolations = 0
  let visualChanges = 0
  const a11yReport: A11yReportEntry[] = []
  const a11yTally = emptyTally()
  const visualTally = emptyTally()
  const rel = (p: string) =>
    p.startsWith(`${pkgDir}/`) ? p.slice(pkgDir.length + 1) : p

  // Each variant is reported as a test — `(pass)`/`(fail)`/`(record)` with its own
  // timing, in `bun test`'s shape — so a CI log can be grepped and summarized. The
  // a11y and visual phases run together on one shared page per variant; the whole
  // set is scanned with bounded concurrency (`mapPool`) since the work is
  // browser-I/O-bound. A variant's lines are buffered and flushed as one block so
  // concurrent variants never interleave mid-test.
  async function scan(t: Target): Promise<void> {
    const ctx: CaseContext = {
      componentId: t.componentId,
      caseId: t.caseId,
      theme: t.theme,
      width: VIEWPORT_WIDTH,
    }
    const name = `${t.componentId}/${t.caseId} [${t.theme}]`
    const out: string[] = []
    const page = await driver.open(t.renderUrl, ctx)
    try {
      if (opts.a11y && a11yThemes.includes(t.theme)) {
        const t0 = Bun.nanoseconds()
        const violations = await page.audit({ exclude: a11yExclude })
        const dur = Bun.nanoseconds() - t0
        if (violations.length) {
          a11yTally.fail++
          a11yReport.push({
            component: t.componentId,
            case: t.caseId,
            theme: t.theme,
            violations,
          })
          out.push(testLine('a11y', name, 'fail', dur))
          for (const v of violations) {
            a11yViolations++
            const sev = v.impact ? `${v.impact} ` : ''
            out.push(`         ${sev}${v.id}: ${v.help} (${v.nodes} node(s))`)
            for (const line of a11yDetailLines(v)) out.push(line)
          }
        } else {
          a11yTally.pass++
          out.push(testLine('a11y', name, 'pass', dur))
        }
      }

      if (opts.visual && diff) {
        const t0 = Bun.nanoseconds()
        const shot = await page.screenshot()
        const file = join(
          baselines,
          t.componentId,
          `${t.caseId}.${t.theme}.png`,
        )
        if (opts.update || !(await Bun.file(file).exists())) {
          await mkdir(dirname(file), { recursive: true })
          await Bun.write(file, shot)
          visualTally.record++
          out.push(testLine('visual', name, 'record', Bun.nanoseconds() - t0))
        } else {
          const baseline = new Uint8Array(await Bun.file(file).arrayBuffer())
          const res = await diff(
            { baseline, actual: shot },
            { ...ctx, baselinePath: file },
          )
          const dur = Bun.nanoseconds() - t0
          if (res.changed) {
            visualChanges++
            visualTally.fail++
            let where = ''
            if (res.diffImage) {
              const diffPath = file.replace(/\.png$/, '.diff.png')
              await Bun.write(diffPath, res.diffImage)
              where = ` → ${rel(diffPath)}`
            }
            out.push(testLine('visual', name, 'fail', dur))
            out.push(`         differs from baseline${where}`)
          } else {
            visualTally.pass++
            out.push(testLine('visual', name, 'pass', dur))
          }
        }
      }
    } finally {
      await page.dispose()
    }
    if (out.length) console.log(out.join('\n'))
  }

  const startedAt = Bun.nanoseconds()
  try {
    await mapPool(targets, concurrency, scan)
  } finally {
    await driver.close()
    server.stop(true)
  }
  const totalNs = Bun.nanoseconds() - startedAt

  const phases: { phase: string; tally: PhaseTally }[] = []
  if (opts.a11y) phases.push({ phase: 'a11y', tally: a11yTally })
  if (opts.visual) phases.push({ phase: 'visual', tally: visualTally })
  for (const line of summaryLines(phases, totalNs, concurrency))
    console.log(line)

  // Persist the full run (every failing variant, with per-node detail) so an
  // agent or human can read the exact failing colours/elements later without
  // re-running the browser. Written under the gitignored cache dir, overwriting
  // the prior run; a clean run leaves an empty `results` so the file is current.
  if (opts.a11y) {
    const reportPath = join(cacheDir(pkgDir), 'a11y', 'last-check.json')
    await mkdir(dirname(reportPath), { recursive: true })
    await Bun.write(
      reportPath,
      `${JSON.stringify(
        {
          scannedAt: Date.now(),
          durationMs: Math.round(totalNs / 1e6),
          total: a11yViolations,
          results: a11yReport,
        },
        null,
        2,
      )}\n`,
    )
    console.log(
      `  a11y detail → ${rel(reportPath)}${a11yViolations ? '' : ' (clean run)'}`,
    )
  }

  const ok =
    a11yViolations === 0 &&
    visualChanges === 0 &&
    tokenViolations === 0 &&
    structureErrors === 0 &&
    ssrErrors === 0 &&
    graphErrors === 0
  const warn = staticWarnings ? `, ${staticWarnings} warning(s)` : ''
  console.log(
    ok
      ? `\n  ✓ checks passed${warn}`
      : `\n  ✗ ${a11yViolations} a11y violation(s), ${visualChanges} visual change(s), ${tokenViolations} token violation(s), ${structureErrors} structure error(s), ${ssrErrors} ssr error(s), ${graphErrors} graph error(s)${warn}`,
  )
  return ok
}
