import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import React from 'react'

/**
 * Diagnose the "two copies of React" environment fault that makes the `ssr`
 * check misreport itself.
 *
 * The `ssr` check renders every case in-process: the renderer (Display Case's
 * own `react-dom/server`, plus the wrapper tree in `render-node`) binds to the
 * React resolved relative to **where Display Case is installed**, while each
 * `*.case.tsx` and its hooks bind to the React resolved relative to the
 * **consumer package** (`pkgDir`). When those two installs differ — the common
 * case for `bunx @awarebydefault/display-case` run from a directory that does
 * not depend on the tool, which fetches it (and its own React peer) into a
 * throwaway temp prefix — there are two React instances. `react-dom/server`
 * arms *its* React's hook dispatcher; the consumer's components read the
 * *other* (null) dispatcher and every hook-using case throws
 * `resolveDispatcher() … useState`. Hook-free cases never touch the dispatcher,
 * so they pass and mask the cause.
 *
 * That is an *environment* fault, not ~N broken components. This module detects
 * the condition once — by **runtime module identity**, not path (symlinks and
 * ESM/CJS dual-loads make path comparison unreliable on its own) — and produces
 * a single, specific diagnosis that names both React copies (path + version),
 * classifies *why* there are two, and prescribes the exact fix. The same
 * concern is solved for `Bun.build` bundles by `pinReact` (`core/pin-react.ts`);
 * the in-process `ssr` path does not bundle, so `pinReact` never runs there and
 * the fault can arise. Until the renderer can be bound to the consumer's React
 * (see the change design), naming the fault precisely is the remedy.
 *
 * The hazard is not React-specific — it is the duplicate-singleton hazard (a
 * package meant to exist once is instantiated twice and the copies do not share
 * the module-scoped state they assume is global) — but React is the loud case
 * the `ssr` check is structurally exposed to, so this guard targets it.
 */

/** Stamp the renderer's React so a *different* copy can be told apart from it by
 *  property identity, not by resolved path. Non-enumerable so it never leaks
 *  into anything that enumerates React's exports. Best-effort: if React's export
 *  object is frozen the stamp is skipped and identity falls back to realpath. */
const IDENTITY = Symbol('display-case.react-identity')
function stampRendererReact(): boolean {
  try {
    Object.defineProperty(React, IDENTITY, {
      value: true,
      enumerable: false,
      configurable: true,
    })
    return (React as Record<symbol, unknown>)[IDENTITY] === true
  } catch {
    return false
  }
}

/** A resolved React copy: where it lives, what version, or why it couldn't be
 *  found. */
export interface ReactLocation {
  /** Absolute path the bare `react` specifier resolved to, or `null` if it could
   *  not be resolved. */
  resolvedPath: string | null
  /** The `react` package root (the dir holding its `package.json`), or `null`. */
  packageDir: string | null
  /** `react`'s declared version, or `null` if it could not be read. */
  version: string | null
  /** The resolution error message, when `react` could not be resolved at all. */
  resolveError: string | null
}

/** Everything the classifier needs, separated from how it was gathered so the
 *  classification can be unit-tested without standing up a real dual-React. */
export interface ReactEnvironmentInfo {
  /** The consumer package the check was pointed at. */
  pkgDir: string
  /** The React the renderer (`react-dom/server` + the wrapper tree) binds to —
   *  resolved relative to where Display Case is installed. */
  renderer: ReactLocation
  /** The React the consumer's cases bind to — resolved relative to `pkgDir`. */
  consumer: ReactLocation
  /**
   * Whether renderer and consumer are the **same** React module instance.
   * `true`/`false` when it could be determined by runtime identity or realpath;
   * `null` when it could not (e.g. the consumer's React could not be imported) —
   * in which case the caller falls back to the runtime symptom (every hook case
   * throwing the dispatcher signature) to decide.
   */
  sameInstance: boolean | null
  /** Whether the renderer's React resolved from a `bunx`/temp throwaway prefix. */
  rendererFromTempPrefix: boolean
  /** Nearest ancestor `package.json` of `pkgDir` that already depends on `react`
   *  — the place to add Display Case so both share one copy. `null` if none. */
  nearestReactDependant: string | null
}

export type ReactFaultKind =
  | 'bunx-temp-install'
  | 'version-conflict'
  | 'duplicate-install'

export interface ReactEnvironmentFault {
  kind: ReactFaultKind
  /** One-line headline (the `result:`-grade summary). */
  summary: string
  /** Full multi-line diagnostic block: both copies, the cause, and the fix. */
  detail: string
}

/**
 * React's signature for a null/duplicate hook dispatcher — the fingerprint of
 * the dual-React fault. A genuine "browser API in render" failure throws about
 * the API (`window is not defined`, `document`, `localStorage`); only a
 * mismatched dispatcher produces `resolveDispatcher`/"Invalid hook call"/"more
 * than one copy of React". Matching this lets the check reclassify such a throw
 * (and the all-identical distribution of them) as the environment fault it is,
 * even when the up-front identity probe could not run.
 */
export function isReactDispatcherError(message: string): boolean {
  return (
    /resolveDispatcher/i.test(message) ||
    /invalid hook call/i.test(message) ||
    /more than one copy of react/i.test(message) ||
    // The dispatcher read phrased as a null-property access. JSC/Bun:
    // "null is not an object (evaluating 'resolveDispatcher().useState')".
    /null is not an object[^\n]*use[A-Z]/.test(message) ||
    // V8/Node: "Cannot read properties of null (reading 'useRef')".
    /cannot read propert[^\n]*of null[^\n]*\buse[A-Z]/i.test(message)
  )
}

/** Read `react`'s declared version from its package root. */
function readReactVersion(packageDir: string | null): string | null {
  if (!packageDir) return null
  try {
    const pkg = JSON.parse(
      readFileSync(join(packageDir, 'package.json'), 'utf8'),
    ) as { version?: string }
    return typeof pkg.version === 'string' ? pkg.version : null
  } catch {
    return null
  }
}

/** Walk up from a resolved `react` entry file to the `react` package root (the
 *  nearest ancestor dir whose `package.json` is `react`). */
function reactPackageDir(resolvedPath: string): string | null {
  let dir = dirname(resolvedPath)
  while (true) {
    const pkgFile = join(dir, 'package.json')
    if (existsSync(pkgFile)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgFile, 'utf8')) as {
          name?: string
        }
        if (pkg.name === 'react') return dir
      } catch {
        // Unreadable package.json — keep walking; an ancestor may be react's.
      }
    }
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

/** Resolve `react` from `fromDir` into a {@link ReactLocation}. */
function locateReact(fromDir: string): ReactLocation {
  try {
    const resolvedPath = Bun.resolveSync('react', fromDir)
    const packageDir = reactPackageDir(resolvedPath)
    return {
      resolvedPath,
      packageDir,
      version: readReactVersion(packageDir),
      resolveError: null,
    }
  } catch (err) {
    return {
      resolvedPath: null,
      packageDir: null,
      version: null,
      resolveError: err instanceof Error ? err.message : String(err),
    }
  }
}

/** Whether a path sits inside a `bunx`/temp throwaway install prefix. */
function isTempPrefix(path: string | null): boolean {
  if (!path) return false
  if (/[/\\]bunx-[^/\\]*[/\\]/.test(path)) return true
  // Anything under the OS temp dir (resolved through any /var → /private/var
  // symlink) is a throwaway prefix too.
  try {
    const tmp = realpathSync(tmpdir())
    const real = existsSync(path) ? realpathSync(path) : path
    return real.startsWith(`${tmp}/`) || real.startsWith(`${tmp}\\`)
  } catch {
    return false
  }
}

/** Nearest ancestor `package.json` of `startDir` (inclusive) that declares a
 *  dependency on `react` in any of deps/devDeps/peerDeps — the package whose
 *  React the cases use, and so the right place to add Display Case. */
export function nearestReactDependant(startDir: string): string | null {
  let dir = resolve(startDir)
  while (true) {
    const pkgFile = join(dir, 'package.json')
    if (existsSync(pkgFile)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgFile, 'utf8')) as Record<
          string,
          Record<string, string> | undefined
        >
        const deps = {
          ...pkg.dependencies,
          ...pkg.devDependencies,
          ...pkg.peerDependencies,
        }
        if (deps.react) return pkgFile
      } catch {
        // Unreadable — keep walking.
      }
    }
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

/** Format both resolved copies as a two-line "Two copies of react:" block. */
function copiesBlock(info: ReactEnvironmentInfo): string {
  const line = (label: string, loc: ReactLocation) => {
    const where = loc.resolvedPath ?? `(unresolved: ${loc.resolveError})`
    const ver = loc.version ? `   (${loc.version})` : ''
    return `  ${label} ${where}${ver}`
  }
  return [
    'Two copies of react were resolved:',
    line('renderer (display-case):', info.renderer),
    line(`your cases (${info.pkgDir}):`, info.consumer),
  ].join('\n')
}

const SYMPTOM =
  'Display Case rendered your cases with a different copy of React than the\n' +
  "cases import, so React's hook dispatcher was null and every hook-using\n" +
  'case threw the same error (e.g. "null is not an object (evaluating\n' +
  "'resolveDispatcher().useState')\"). These are NOT component bugs and no\n" +
  'case touched a browser API — do not move code into effects or add\n' +
  'browserOnly. The fix is the install, below.'

/** The fix line that names the concrete package to add Display Case to. */
function colocateFix(info: ReactEnvironmentInfo): string {
  const target = info.nearestReactDependant ?? join(info.pkgDir, 'package.json')
  return (
    `Fix: add "@awarebydefault/display-case" to ${target}\n` +
    '(the package that provides the React your cases use), reinstall, and\n' +
    'rerun the check so the tool and your cases resolve a single shared React.\n' +
    'Equivalent one-off: run the workspace-installed binary instead of bunx —\n' +
    '  bun <repo>/node_modules/.bin/display-case check <pkg>'
  )
}

/**
 * Classify a resolved {@link ReactEnvironmentInfo} into a single, prescriptive
 * fault — or `null` when there is no fault (one shared React). Pure: no I/O, so
 * every branch is unit-testable by constructing the info directly.
 */
export function classifyReactEnvironment(
  info: ReactEnvironmentInfo,
): ReactEnvironmentFault | null {
  // No fault unless a genuine split was proven. A consumer with no resolvable
  // React is *not* a fault: a showcase of only hook-free cases legitimately
  // needs no React, and a hook case that needs one but lacks it fails at module
  // import (surfaced as a load error elsewhere), not here. `sameInstance` is
  // `null` (inconclusive) in that case, and an inconclusive probe must not
  // fabricate a fault — the runtime symptom is the fallback signal.
  if (info.sameInstance !== false) return null

  const head = `${SYMPTOM}\n\n${copiesBlock(info)}\n\n`

  if (info.rendererFromTempPrefix) {
    return {
      kind: 'bunx-temp-install',
      summary:
        'SSR ran with a different React than your cases — display-case is ' +
        'running from a bunx/temp install with its own React. Fix the ' +
        'install, not the components.',
      detail:
        head +
        'Cause: display-case is running from a throwaway install (a bunx/temp\n' +
        'prefix) that carries its own React peer, separate from the React your\n' +
        'cases import.\n\n' +
        colocateFix(info),
    }
  }

  if (
    info.renderer.version &&
    info.consumer.version &&
    info.renderer.version !== info.consumer.version
  ) {
    return {
      kind: 'version-conflict',
      summary:
        'SSR ran with a different React than your cases (version conflict: ' +
        `${info.renderer.version} vs ${info.consumer.version}) — align the ` +
        'versions, not the components.',
      detail:
        head +
        `Cause: the two installs are different React versions (${info.renderer.version}\n` +
        `vs ${info.consumer.version}), so they are necessarily different module\n` +
        'instances — a real version conflict, not just a duplicate.\n\n' +
        'Fix: align the React versions across display-case and your cases (dedupe\n' +
        'to one version — a single hoisted react/react-dom, or matching "react"\n' +
        'ranges), reinstall, and rerun. Colocating the tool alone will not help\n' +
        'while the versions differ.',
    }
  }

  const ver = info.consumer.version ? `react@${info.consumer.version}` : 'react'
  return {
    kind: 'duplicate-install',
    summary:
      `SSR ran with a different React than your cases (two un-deduped ${ver} ` +
      'installs) — dedupe, not the components.',
    detail:
      head +
      `Cause: both are ${ver} but resolved from different node_modules, so they\n` +
      'are two un-deduped instances of the same version.\n\n' +
      colocateFix(info),
  }
}

/**
 * Gather the React environment for `pkgDir`: resolve both copies, determine
 * whether they are the same instance (by runtime identity, falling back to
 * realpath), and classify. Returns the gathered `info` alongside the `fault`
 * (`null` when there is one shared React, or when a split could not be proven)
 * so the caller can reuse the resolved paths/versions for the runtime-symptom
 * fallback without resolving twice.
 */
export async function diagnoseReactEnvironment(pkgDir: string): Promise<{
  info: ReactEnvironmentInfo
  fault: ReactEnvironmentFault | null
}> {
  const renderer = locateReact(import.meta.dir)
  const consumer = locateReact(pkgDir)

  let sameInstance: boolean | null = null
  if (consumer.resolveError) {
    sameInstance = null
  } else if (renderer.resolvedPath && consumer.resolvedPath) {
    // Primary signal: runtime module identity. Stamp the renderer's React and
    // check whether the consumer's resolved React object carries the stamp.
    const stamped = stampRendererReact()
    if (stamped) {
      try {
        const ns = (await import(consumer.resolvedPath)) as Record<
          string | symbol,
          unknown
        > & { default?: Record<symbol, unknown> }
        const consumerReact = ns.default ?? ns
        sameInstance =
          (consumerReact as Record<symbol, unknown>)[IDENTITY] === true ||
          (ns as Record<symbol, unknown>)[IDENTITY] === true
      } catch {
        sameInstance = null
      }
    }
    // Fallback / corroboration: compare canonical paths. Only used to *confirm*
    // a split the identity probe couldn't establish (stamp failed or import
    // threw) — a path match is treated as same, a mismatch as different.
    if (sameInstance === null) {
      try {
        sameInstance =
          realpathSync(renderer.resolvedPath) ===
          realpathSync(consumer.resolvedPath)
      } catch {
        sameInstance = null
      }
    }
  }

  const info: ReactEnvironmentInfo = {
    pkgDir,
    renderer,
    consumer,
    sameInstance,
    rendererFromTempPrefix: isTempPrefix(renderer.resolvedPath),
    nearestReactDependant: nearestReactDependant(pkgDir),
  }
  return { info, fault: classifyReactEnvironment(info) }
}

/**
 * Build a fault from the runtime *symptom* when the up-front probe was
 * inconclusive (`sameInstance === null`) but every hook-using case threw the
 * dispatcher fingerprint. The distribution itself is the tell: real
 * render-purity failures are sporadic and API-specific, so an all-identical
 * dispatcher signature across cases is structural. Reuses the already-resolved
 * `info`; forces the split classification by asserting `sameInstance = false`.
 */
export function faultFromSymptom(
  info: ReactEnvironmentInfo,
): ReactEnvironmentFault {
  const forced = classifyReactEnvironment({ ...info, sameInstance: false })
  if (forced) return forced
  // No path/version detail available — still report the environment fault
  // generically rather than as per-case component bugs.
  return {
    kind: 'duplicate-install',
    summary:
      'SSR ran with a different React than your cases — every hook-using case ' +
      'hit a null hook dispatcher. This is an environment fault, not your ' +
      'components.',
    detail:
      SYMPTOM +
      '\n\nThe two React copies could not be located precisely, but the ' +
      'identical\nnull-dispatcher failure across every hook-using case is the ' +
      'duplicate-React\nsignature. Ensure display-case and your cases resolve a ' +
      'single shared\nreact/react-dom (install the tool where your cases’ ' +
      'React lives, or\ndedupe the workspace), then rerun the check.',
  }
}
