import { renderToString } from 'react-dom/server'
import { buildCatalog } from './catalog'
import { discoverCaseFiles, loadModules, resolveConfig } from './discovery'
import { caseTree, NOOP_GOTO } from './render-node'

/**
 * The `ssr` check: render every case on the server (`renderToString`, no
 * browser) and flag any that can't — i.e. that touch a browser-only API
 * *during render* and throw. This enforces the pre-scripting-rendering best
 * practice: keep a case's render pure (browser APIs belong in effects and
 * handlers, which never run on the server). It is the precise, zero-false-
 * positive counterpart to a static "no browser APIs" lint, because it tests the
 * one thing that matters — does this case pre-render? — rather than guessing
 * from syntax whether a `window` reference sits in render or in an effect.
 *
 * A component declared `browserOnly` (in its case meta) is expected to need a
 * browser; its cases are counted as declared, not flagged. The check is static
 * in spirit (no server, no browser) and runs in the one-shot check process, so
 * a bare module import is always current.
 */

export interface SsrFinding {
  /** Absolute path of the case file the finding is attributed to. */
  file: string
  /** Showcased component display name. */
  component: string
  /** Case display name. */
  case: string
  /** The throw's message (what browser API the render reached). */
  error: string
}

export interface SsrCheckResult {
  findings: SsrFinding[]
  /** Cases that rendered on the server cleanly. */
  rendered: number
  /** Cases skipped because their component is declared `browserOnly`. */
  declared: number
}

export async function checkSsr(pkgDir: string): Promise<SsrCheckResult> {
  const { config } = await resolveConfig(pkgDir)
  const files = await discoverCaseFiles(pkgDir, config)
  const { modules } = await loadModules(files)

  // Map a component's display name to its source file and its declared
  // browser-only flag, so a finding can point at the file and declared
  // components can be skipped.
  const byName = new Map(modules.map((m) => [m.module.component, m]))
  const caseModules = modules.map((m) => m.module)
  const catalog = buildCatalog(caseModules)

  const findings: SsrFinding[] = []
  let rendered = 0
  let declared = 0

  for (const component of catalog) {
    const loaded = byName.get(component.name)
    if (!loaded) continue
    if (loaded.module.browserOnly) {
      declared += component.cases.length
      continue
    }
    for (const cs of component.cases) {
      try {
        renderToString(
          caseTree(
            caseModules,
            config,
            {
              componentId: component.id,
              caseId: cs.id,
              width: null,
              tweaks: {},
            },
            NOOP_GOTO,
          ),
        )
        rendered++
      } catch (err) {
        findings.push({
          file: loaded.file,
          component: component.name,
          case: cs.name,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
  }

  return { findings, rendered, declared }
}
