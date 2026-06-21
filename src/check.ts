import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { baselineDir, cacheDir, resolveConfig } from './discovery'
import type {
  A11yViolation,
  CaseContext,
  DiffFn,
  DisplayCaseConfig,
  RenderDriver,
} from './index'
import { startDisplayCase } from './server'
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
  update: boolean
  /** Treat structure warnings as errors (CLI `--strict`). */
  strict?: boolean
  port?: number
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

  const staticErrors = tokenViolations + structureErrors + ssrErrors

  // The browser phases (a11y + visual) are the only ones needing a live render.
  if (!opts.a11y && !opts.visual) {
    const ok = staticErrors === 0
    const warn = structureWarnings ? `, ${structureWarnings} warning(s)` : ''
    console.log(
      ok
        ? `\n  ✓ checks passed${warn}`
        : `\n  ✗ ${tokenViolations} token violation(s), ${structureErrors} structure error(s), ${ssrErrors} ssr error(s)${warn}`,
    )
    return ok
  }

  const server = await startDisplayCase(pkgDir, { port: opts.port ?? 0 })
  const base = String(server.url).replace(/\/$/, '')
  const manifest = await fetch(`${base}/manifest.json`).then((r) => r.json())

  const targets: Target[] = []
  for (const c of manifest.components) {
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

  let a11yViolations = 0
  let visualChanges = 0
  let recorded = 0
  const a11yReport: A11yReportEntry[] = []

  try {
    for (const t of targets) {
      const ctx: CaseContext = {
        componentId: t.componentId,
        caseId: t.caseId,
        theme: t.theme,
        width: VIEWPORT_WIDTH,
      }
      const page = await driver.open(t.renderUrl, ctx)

      if (opts.a11y && a11yThemes.includes(t.theme)) {
        const violations = await page.audit({ exclude: a11yExclude })
        if (violations.length) {
          a11yReport.push({
            component: t.componentId,
            case: t.caseId,
            theme: t.theme,
            violations,
          })
        }
        for (const v of violations) {
          a11yViolations++
          const sev = v.impact ? `${v.impact} ` : ''
          console.error(
            `  a11y ✗ ${t.componentId}/${t.caseId} [${t.theme}] ${sev}${v.id}: ${v.help} (${v.nodes} node(s))`,
          )
          for (const line of a11yDetailLines(v)) console.error(line)
        }
      }

      if (opts.visual && diff) {
        const shot = await page.screenshot()
        const file = join(
          baselines,
          t.componentId,
          `${t.caseId}.${t.theme}.png`,
        )
        if (opts.update || !(await Bun.file(file).exists())) {
          await mkdir(dirname(file), { recursive: true })
          await Bun.write(file, shot)
          recorded++
        } else {
          const baseline = new Uint8Array(await Bun.file(file).arrayBuffer())
          const res = await diff(
            { baseline, actual: shot },
            { ...ctx, baselinePath: file },
          )
          if (res.changed) {
            visualChanges++
            if (res.diffImage) {
              await Bun.write(
                file.replace(/\.png$/, '.diff.png'),
                res.diffImage,
              )
            }
            console.error(
              `  visual ✗ ${t.componentId}/${t.caseId} [${t.theme}] differs from baseline`,
            )
          }
        }
      }

      await page.dispose()
    }
  } finally {
    await driver.close()
    server.stop(true)
  }

  if (opts.visual && recorded) console.log(`  recorded ${recorded} baseline(s)`)

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
        { scannedAt: Date.now(), total: a11yViolations, results: a11yReport },
        null,
        2,
      )}\n`,
    )
    const rel = reportPath.startsWith(`${pkgDir}/`)
      ? reportPath.slice(pkgDir.length + 1)
      : reportPath
    console.log(`  a11y detail → ${rel}${a11yViolations ? '' : ' (clean run)'}`)
  }

  const ok =
    a11yViolations === 0 &&
    visualChanges === 0 &&
    tokenViolations === 0 &&
    structureErrors === 0 &&
    ssrErrors === 0
  const warn = structureWarnings ? `, ${structureWarnings} warning(s)` : ''
  console.log(
    ok
      ? `\n  ✓ checks passed${warn}`
      : `\n  ✗ ${a11yViolations} a11y violation(s), ${visualChanges} visual change(s), ${tokenViolations} token violation(s), ${structureErrors} structure error(s), ${ssrErrors} ssr error(s)${warn}`,
  )
  return ok
}
