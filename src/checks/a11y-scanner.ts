import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { cacheDir } from '../core/discovery'
import type { A11yViolation, DisplayCaseConfig, RenderDriver } from '../index'

/**
 * On-demand, cached accessibility scanner for the running browse server.
 *
 * It owns ONE lazily-launched render driver (reused across scans) and a serial
 * job queue, so a scan never blocks request handling and the heavy browser is
 * started only if a scan is actually requested. Results are cached on disk under
 * `.display-case/a11y/` and reused until the scanned variant's rendered output
 * changes — judged by a per-variant transitive-input content hash, with a
 * mtime/size fast path so an unchanged variant costs a few `stat`s.
 *
 * The scan prerequisite (a headless browser + axe) is optional: if it can't be
 * launched, the scanner flips to an `unavailable` status instead of throwing, so
 * the server keeps browsing.
 */

export type A11yScanStatus =
  | { status: 'ok'; violations: A11yViolation[] }
  | { status: 'pending' }
  | { status: 'unavailable'; reason: string }

export interface A11yScannerOptions {
  pkgDir: string
  config: DisplayCaseConfig
  /** Live base URL of the running server (e.g. `http://localhost:3100`). */
  baseUrl: () => string
  /** Absolute path to a component's `.case.tsx`, or null if unknown. */
  caseFileAbs: (componentId: string) => string | null
  /** Called when a queued scan resolves, so the server can push the result. */
  onResult: (
    componentId: string,
    caseId: string,
    theme: 'light' | 'dark',
    status: A11yScanStatus,
  ) => void
}

/** A single auditable variant: one case rendered under one theme. */
export interface A11yVariant {
  componentId: string
  caseId: string
  theme: 'light' | 'dark'
}

/** How the navigation is populated at start-up (mirrors `config.a11y.startup`). */
export type A11yStartupMode = 'off' | 'cached' | 'refresh'

export interface A11yScanner {
  /** Cached result if still valid, else enqueues a scan and reports `pending`.
   *  Reports `unavailable` if the scan prerequisite can't be launched. Pass
   *  `force` to drop the cached entry and re-scan (the panel's "re-scan"). */
  request: (
    componentId: string,
    caseId: string,
    theme: 'light' | 'dark',
    force?: boolean,
  ) => Promise<A11yScanStatus>
  /** Populate the navigation at start-up without changing the on-demand flow.
   *  `cached` emits only the variants with a reusable cached result (no scans);
   *  `refresh` additionally enqueues every uncached or stale variant so its
   *  verdict lands over the same `onResult` path. `off` is a no-op. Each emitted
   *  result is delivered through the scanner's `onResult` callback. Runs nothing
   *  and emits nothing when the scan prerequisite is unavailable. Never awaits a
   *  scan — returns once cached results are emitted and pending work is queued. */
  populateAtStartup: (
    variants: A11yVariant[],
    mode: A11yStartupMode,
  ) => Promise<void>
  /** Forget in-flight bookkeeping after a rebuild; the on-disk hashes still gate
   *  whether anything actually re-scans. */
  invalidateAll: () => void
  close: () => Promise<void>
}

interface Job {
  componentId: string
  caseId: string
  theme: 'light' | 'dark'
  key: string
}

interface CacheEntry {
  toolVersion: string
  hash: string
  files: { path: string; mtimeMs: number; size: number }[]
  violations: A11yViolation[]
  scannedAt: number
}

const IMPORT_RE =
  /(?:import|export)\b[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s*['"]([^'"]+)['"]/g
const RESOLVE_EXTS = ['', '.ts', '.tsx', '.css', '.md', '.mdx']
const RESOLVE_INDEX = ['/index.ts', '/index.tsx']
const MAX_FILES = 400

/** Display Case's own version — folded into every hash so the cache busts when
 *  the tool (chrome, render harness) changes under the same consumer. */
let toolVersionCache: string | null = null
function toolVersion(): string {
  if (toolVersionCache) return toolVersionCache
  try {
    const pkg = JSON.parse(
      readFileSync(join(import.meta.dir, '..', '..', 'package.json'), 'utf8'),
    ) as { version?: string }
    toolVersionCache = pkg.version ?? '0'
  } catch {
    toolVersionCache = '0'
  }
  return toolVersionCache
}

/** Resolve a relative import specifier to a file within the package. */
function resolveSpecifier(fromFile: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null // bare/package import — out of scope
  const base = resolve(dirname(fromFile), spec)
  for (const ext of RESOLVE_EXTS) {
    if (ext && existsSync(base + ext)) return base + ext
  }
  if (existsSync(base) && !statSync(base).isDirectory()) return base
  for (const idx of RESOLVE_INDEX) {
    if (existsSync(base + idx)) return base + idx
  }
  return null
}

/** Crawl the transitive, in-package import set reachable from a case file. */
async function transitiveFiles(
  entry: string,
  pkgDir: string,
): Promise<string[]> {
  const seen = new Set<string>()
  const stack = [entry]
  while (stack.length && seen.size < MAX_FILES) {
    const file = stack.pop()
    if (!file || seen.has(file)) continue
    if (file.includes('/node_modules/') || !file.startsWith(pkgDir)) continue
    seen.add(file)
    let src: string
    try {
      src = await readFile(file, 'utf8')
    } catch {
      continue
    }
    IMPORT_RE.lastIndex = 0
    let m: RegExpExecArray | null = IMPORT_RE.exec(src)
    while (m) {
      const spec = m[1] ?? m[2] ?? m[3]
      if (spec) {
        const resolved = resolveSpecifier(file, spec)
        if (resolved && !seen.has(resolved)) stack.push(resolved)
      }
      m = IMPORT_RE.exec(src)
    }
  }
  return [...seen].sort()
}

export function createA11yScanner(opts: A11yScannerOptions): A11yScanner {
  const { pkgDir, config, baseUrl, caseFileAbs, onResult } = opts
  const dir = join(cacheDir(pkgDir), 'a11y')

  let driverPromise: Promise<RenderDriver> | null = null
  let driver: RenderDriver | null = null
  let unavailableReason: string | null = null
  const inFlight = new Set<string>()
  const queue: Job[] = []
  let pumping = false

  async function ensureDriver(): Promise<RenderDriver> {
    if (unavailableReason) throw new Error(unavailableReason)
    if (!driverPromise) {
      driverPromise = (
        config.providers?.driver
          ? Promise.resolve(config.providers.driver())
          : import('./providers/playwright-driver').then((m) =>
              m.createPlaywrightDriver(),
            )
      ).catch((err: unknown) => {
        unavailableReason = err instanceof Error ? err.message : String(err)
        driverPromise = null
        throw err
      })
    }
    driver = await driverPromise
    return driver
  }

  const cachePath = (key: string) => join(dir, `${key}.json`)

  /** Globs the consumer's shared style inputs into the hash so a token/global
   *  edit invalidates every variant (not just the case-local import graph). */
  async function sharedInputs(): Promise<string[]> {
    const out: string[] = []
    for (const rel of config.globalStyles ?? []) {
      const abs = resolve(pkgDir, rel)
      if (existsSync(abs)) out.push(abs)
    }
    return out
  }

  async function fingerprint(
    componentId: string,
  ): Promise<{ files: CacheEntry['files']; hash: string } | null> {
    const caseFile = caseFileAbs(componentId)
    if (!caseFile) return null
    const files = [
      ...new Set([
        ...(await transitiveFiles(caseFile, pkgDir)),
        ...(await sharedInputs()),
      ]),
    ].sort()
    const hasher = createHash('sha256')
    hasher.update(toolVersion())
    const stats: CacheEntry['files'] = []
    for (const f of files) {
      let st: ReturnType<typeof statSync>
      try {
        st = statSync(f)
      } catch {
        continue
      }
      stats.push({
        path: relative(pkgDir, f),
        mtimeMs: st.mtimeMs,
        size: st.size,
      })
      hasher.update(`\0${relative(pkgDir, f)}\0`)
      hasher.update(await readFile(f))
    }
    return { files: stats, hash: hasher.digest('hex') }
  }

  async function readEntry(key: string): Promise<CacheEntry | null> {
    try {
      return JSON.parse(await readFile(cachePath(key), 'utf8')) as CacheEntry
    } catch {
      return null
    }
  }

  /** Layered validity: stat the stored file set first (no reads); only when a
   *  stat differs do we re-crawl + content-hash to confirm a real change. */
  async function cachedViolations(
    componentId: string,
    key: string,
  ): Promise<A11yViolation[] | null> {
    const entry = await readEntry(key)
    if (!entry || entry.toolVersion !== toolVersion()) return null
    const statsMatch = entry.files.every((rec) => {
      try {
        const st = statSync(resolve(pkgDir, rec.path))
        return st.mtimeMs === rec.mtimeMs && st.size === rec.size
      } catch {
        return false
      }
    })
    if (statsMatch) return entry.violations
    const fp = await fingerprint(componentId)
    if (fp && fp.hash === entry.hash) {
      // Touched but unchanged — refresh stored stats so the fast path holds next
      // time, and reuse the result.
      await writeFile(
        cachePath(key),
        JSON.stringify({ ...entry, files: fp.files }),
      )
      return entry.violations
    }
    return null
  }

  async function writeCache(
    componentId: string,
    key: string,
    violations: A11yViolation[],
  ): Promise<void> {
    const fp = await fingerprint(componentId)
    if (!fp) return
    const entry: CacheEntry = {
      toolVersion: toolVersion(),
      hash: fp.hash,
      files: fp.files,
      violations,
      scannedAt: Date.now(),
    }
    await mkdir(dir, { recursive: true })
    await writeFile(cachePath(key), JSON.stringify(entry))
  }

  async function runJob(job: Job): Promise<void> {
    let status: A11yScanStatus
    try {
      const d = await ensureDriver()
      // `dcscan` asks the server for a render doc WITHOUT the live-reload SSE —
      // the driver waits for network idle, which an open SSE would never reach.
      const url = `${baseUrl()}/render/${job.componentId}/${job.caseId}?theme=${job.theme}&dcscan=1`
      const page = await d.open(url, {
        componentId: job.componentId,
        caseId: job.caseId,
        theme: job.theme,
        width: 1024,
      })
      try {
        const violations = await page.audit({ exclude: config.a11y?.exclude })
        await writeCache(job.componentId, job.key, violations)
        status = { status: 'ok', violations }
      } finally {
        await page.dispose()
      }
    } catch (err) {
      status = {
        status: 'unavailable',
        reason:
          unavailableReason ??
          (err instanceof Error ? err.message : String(err)),
      }
    }
    inFlight.delete(job.key)
    onResult(job.componentId, job.caseId, job.theme, status)
  }

  async function pump(): Promise<void> {
    if (pumping) return
    pumping = true
    try {
      while (queue.length) {
        const job = queue.shift()
        if (job) await runJob(job)
      }
    } finally {
      pumping = false
    }
  }

  return {
    async request(componentId, caseId, theme, force) {
      if (unavailableReason) {
        return { status: 'unavailable', reason: unavailableReason }
      }
      const key = `${componentId}__${caseId}__${theme}`
      if (inFlight.has(key)) return { status: 'pending' }
      if (force) {
        // Re-scan: drop the cached entry so the queued job recomputes it.
        await rm(cachePath(key), { force: true })
      } else {
        const cached = await cachedViolations(componentId, key)
        if (cached) return { status: 'ok', violations: cached }
      }
      inFlight.add(key)
      queue.push({ componentId, caseId, theme, key })
      void pump().catch(() => {})
      return { status: 'pending' }
    },
    async populateAtStartup(variants, mode) {
      if (mode !== 'cached' && mode !== 'refresh') return
      // Already known-unavailable (e.g. a prior request probed the driver): emit
      // nothing — the per-variant unavailable state still shows on view.
      if (unavailableReason) return

      // Emit every reusable cached result up front (both modes), collecting the
      // misses so `refresh` can scan them. `cached` mode stops after this.
      const toScan: Job[] = []
      for (const v of variants) {
        const key = `${v.componentId}__${v.caseId}__${v.theme}`
        if (inFlight.has(key)) continue
        const cached = await cachedViolations(v.componentId, key)
        if (cached) {
          onResult(v.componentId, v.caseId, v.theme, {
            status: 'ok',
            violations: cached,
          })
        } else if (mode === 'refresh') {
          toScan.push({ ...v, key })
        }
      }
      if (mode !== 'refresh' || !toScan.length) return

      // Probe the scan prerequisite once before flooding the queue: if the
      // browser can't launch, surface nothing at start-up rather than a burst of
      // `unavailable` events (the on-demand path still reports it on view).
      try {
        await ensureDriver()
      } catch {
        return
      }
      for (const job of toScan) {
        if (inFlight.has(job.key)) continue
        inFlight.add(job.key)
        queue.push(job)
      }
      void pump().catch(() => {})
    },
    invalidateAll() {
      // In-flight jobs finish; nothing else to drop — the on-disk hashes decide
      // whether the next request re-scans.
      inFlight.clear()
    },
    async close() {
      queue.length = 0
      if (driver) await driver.close().catch(() => {})
      driver = null
      driverPromise = null
    },
  }
}
