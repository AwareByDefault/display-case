import { renderToString } from 'react-dom/server'
import { buildCatalog } from '../core/catalog'
import {
  discoverCaseFiles,
  loadModules,
  resolveConfig,
} from '../core/discovery'
import { caseTree, NOOP_GOTO } from '../render/render-node'
import {
  diagnoseReactEnvironment,
  faultFromSymptom,
  isReactDispatcherError,
  type ReactEnvironmentFault,
} from './react-identity'

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
 *
 * One environment fault is detected and reported *as such*, instead of as N
 * per-case failures: if the renderer's React is a different module instance than
 * the consumer's cases use (the dual-React/null-dispatcher hazard — see
 * `react-identity`), every hook-using case throws an identical
 * `resolveDispatcher()` error that has nothing to do with the component. The
 * check probes for that condition up front (and falls back to the runtime
 * symptom) and emits a single diagnosed {@link SsrEnvironmentFault} rather than
 * blaming each case.
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

/**
 * A single environment fault (not a per-case failure): the SSR sweep could not
 * run meaningfully because the renderer and the cases bound to different React
 * instances. Reported once, with a full diagnosis, instead of as N false
 * "fix your component" findings.
 */
export interface SsrEnvironmentFault extends ReactEnvironmentFault {
  /** Cases that were not server-rendered because the sweep was skipped (or its
   *  results discarded) on account of this fault. */
  skipped: number
}

export interface SsrCheckResult {
  findings: SsrFinding[]
  /** Cases that rendered on the server cleanly. */
  rendered: number
  /** Cases skipped because their component is declared `browserOnly`. */
  declared: number
  /** Set when the sweep was invalidated by a dual-React environment fault; when
   *  present, `findings` is empty (the per-case failures were the fault's
   *  symptom, not real component bugs). */
  environment?: SsrEnvironmentFault
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

  // How many cases the sweep would attempt (everything not declared
  // browser-only) — reported as `skipped` if an environment fault aborts it.
  let renderable = 0
  let declared = 0
  for (const component of catalog) {
    const loaded = byName.get(component.name)
    if (!loaded) continue
    if (loaded.module.browserOnly) declared += component.cases.length
    else renderable += component.cases.length
  }

  // Up-front probe: if the renderer's React is a different instance than the
  // cases', every hook-using case would throw an identical null-dispatcher
  // error. Detect and diagnose that once, and skip the sweep entirely — running
  // it would only manufacture `renderable` false positives.
  const { info, fault } = await diagnoseReactEnvironment(pkgDir)
  if (fault) {
    return {
      findings: [],
      rendered: 0,
      declared,
      environment: { ...fault, skipped: renderable },
    }
  }

  const findings: SsrFinding[] = []
  let rendered = 0

  for (const component of catalog) {
    const loaded = byName.get(component.name)
    if (!loaded) continue
    if (loaded.module.browserOnly) continue
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

  // Runtime-symptom safety net: the up-front probe can be inconclusive (the
  // consumer's React couldn't be imported, or the stamp didn't take). If it was,
  // and yet multiple cases all failed with the React null-dispatcher
  // fingerprint, that all-identical distribution is itself the tell — real
  // render-purity failures are sporadic and API-specific. Collapse them into one
  // diagnosed environment fault rather than emitting them as component bugs.
  if (
    info.sameInstance === null &&
    findings.length >= 2 &&
    findings.every((f) => isReactDispatcherError(f.error))
  ) {
    return {
      findings: [],
      rendered,
      declared,
      environment: { ...faultFromSymptom(info), skipped: findings.length },
    }
  }

  return { findings, rendered, declared }
}
