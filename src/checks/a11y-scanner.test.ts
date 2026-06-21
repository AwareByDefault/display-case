import { afterEach, expect, test } from 'bun:test'
import { readFileSync, statSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { cacheDir } from '../core/discovery'
import type {
  A11yViolation,
  DisplayCaseConfig,
  RenderDriver,
  RenderedPage,
} from '../index'
import { makeTempDir, writeFiles } from '../testing/test-helpers'
import {
  type A11yScanStatus,
  type A11yVariant,
  createA11yScanner,
} from './a11y-scanner'

const dirs: string[] = []
afterEach(async () => {
  while (dirs.length)
    await rm(dirs.pop() as string, { recursive: true, force: true })
})

// Display Case's own version, mirrored exactly so the cache entries we hand-write
// are accepted (a `toolVersion` mismatch discards an entry).
const TOOL_VERSION = (() => {
  try {
    return (
      (
        JSON.parse(
          readFileSync(
            join(import.meta.dir, '..', '..', 'package.json'),
            'utf8',
          ),
        ) as { version?: string }
      ).version ?? '0'
    )
  } catch {
    return '0'
  }
})()

const VIOLATION: A11yViolation = {
  id: 'color-contrast',
  help: 'Elements must have sufficient contrast',
  nodes: 1,
  impact: 'serious',
}

/** A render driver whose audit always returns one violation; records opens. */
function fakeDriver(opens: string[]): RenderDriver {
  const page: RenderedPage = {
    screenshot: async () => new Uint8Array(),
    audit: async () => [VIOLATION],
    dispose: async () => {},
  }
  return {
    open: async (url) => {
      opens.push(url)
      return page
    },
    close: async () => {},
  }
}

/** A driver that cannot launch — stands in for a missing browser/axe. */
function failingDriver(): RenderDriver {
  throw new Error('no browser')
}

interface Harness {
  pkgDir: string
  caseAbs: Record<string, string>
}

/** Temp package with `n` case files, each importing nothing. */
async function harness(ids: string[]): Promise<Harness> {
  const pkgDir = await makeTempDir()
  dirs.push(pkgDir)
  const files: Record<string, string> = {}
  const caseAbs: Record<string, string> = {}
  for (const id of ids) {
    files[`src/${id}.case.tsx`] = `export const cases = {} // ${id}\n`
    caseAbs[id] = join(pkgDir, `src/${id}.case.tsx`)
  }
  await writeFiles(pkgDir, files)
  return { pkgDir, caseAbs }
}

/** Hand-write a cache entry whose recorded stats match the case file on disk, so
 *  the scanner's stat fast-path accepts it as reusable without a content hash. */
async function seedCache(
  h: Harness,
  componentId: string,
  caseId: string,
  theme: string,
  violations: A11yViolation[],
): Promise<void> {
  const dir = join(cacheDir(h.pkgDir), 'a11y')
  await mkdir(dir, { recursive: true })
  const abs = h.caseAbs[componentId]
  const st = statSync(abs)
  const entry = {
    toolVersion: TOOL_VERSION,
    hash: 'unused-when-stats-match',
    files: [
      { path: relative(h.pkgDir, abs), mtimeMs: st.mtimeMs, size: st.size },
    ],
    violations,
    scannedAt: 1,
  }
  await writeFile(
    join(dir, `${componentId}__${caseId}__${theme}.json`),
    JSON.stringify(entry),
  )
}

function makeScanner(
  h: Harness,
  driverFactory: () => RenderDriver,
  onResult: (
    c: string,
    cs: string,
    th: 'light' | 'dark',
    s: A11yScanStatus,
  ) => void,
) {
  const config: DisplayCaseConfig = {
    title: 'T',
    roots: ['src/**/*.case.tsx'],
    providers: { driver: driverFactory },
  }
  return createA11yScanner({
    pkgDir: h.pkgDir,
    config,
    baseUrl: () => 'http://localhost:0',
    caseFileAbs: (id) => h.caseAbs[id] ?? null,
    onResult,
  })
}

const variant = (
  componentId: string,
  caseId: string,
  theme: 'light' | 'dark',
): A11yVariant => ({ componentId, caseId, theme })

test('off mode is a no-op: no results, no scans', async () => {
  const h = await harness(['foo'])
  await seedCache(h, 'foo', 'default', 'light', [VIOLATION])
  const opens: string[] = []
  const calls: string[] = []
  const scanner = makeScanner(
    h,
    () => fakeDriver(opens),
    (c, cs, th) => calls.push(`${c}/${cs}/${th}`),
  )
  await scanner.populateAtStartup([variant('foo', 'default', 'light')], 'off')
  expect(calls).toEqual([])
  expect(opens).toEqual([])
  await scanner.close()
})

test('cached mode emits reusable cached results and runs no scans', async () => {
  const h = await harness(['foo', 'bar'])
  await seedCache(h, 'foo', 'default', 'light', [VIOLATION])
  // `bar` has no cache entry → it must stay unmarked (no emit) in cached mode.
  const opens: string[] = []
  const results: Array<{ id: string; status: A11yScanStatus }> = []
  const scanner = makeScanner(
    h,
    () => fakeDriver(opens),
    (c, cs, th, status) => results.push({ id: `${c}/${cs}/${th}`, status }),
  )
  await scanner.populateAtStartup(
    [variant('foo', 'default', 'light'), variant('bar', 'default', 'light')],
    'cached',
  )
  expect(results).toHaveLength(1)
  expect(results[0].id).toBe('foo/default/light')
  expect(results[0].status).toEqual({ status: 'ok', violations: [VIOLATION] })
  expect(opens).toEqual([]) // never launched the driver
  await scanner.close()
})

test('refresh mode reuses fresh cache and scans uncached/stale variants', async () => {
  const h = await harness(['foo', 'bar'])
  await seedCache(h, 'foo', 'default', 'light', [VIOLATION])
  // `bar` is uncached → refresh must scan it via the driver.
  const opens: string[] = []
  const results: Array<{ id: string; status: A11yScanStatus }> = []
  let resolveScan: () => void = () => {}
  const scanned = new Promise<void>((r) => {
    resolveScan = r
  })
  const scanner = makeScanner(
    h,
    () => fakeDriver(opens),
    (c, cs, th, status) => {
      results.push({ id: `${c}/${cs}/${th}`, status })
      if (c === 'bar') resolveScan()
    },
  )
  await scanner.populateAtStartup(
    [variant('foo', 'default', 'light'), variant('bar', 'default', 'light')],
    'refresh',
  )
  await scanned
  const byId = Object.fromEntries(results.map((r) => [r.id, r.status]))
  // foo came straight from cache (no scan); bar was scanned.
  expect(byId['foo/default/light']).toEqual({
    status: 'ok',
    violations: [VIOLATION],
  })
  expect(byId['bar/default/light']).toEqual({
    status: 'ok',
    violations: [VIOLATION],
  })
  expect(opens).toHaveLength(1)
  expect(opens[0]).toContain('/render/bar/default')
  await scanner.close()
})

test('refresh mode emits nothing extra when the scan prerequisite is unavailable', async () => {
  const h = await harness(['foo', 'bar'])
  await seedCache(h, 'foo', 'default', 'light', [VIOLATION])
  const results: string[] = []
  const scanner = makeScanner(h, failingDriver, (c, cs, th) =>
    results.push(`${c}/${cs}/${th}`),
  )
  await scanner.populateAtStartup(
    [variant('foo', 'default', 'light'), variant('bar', 'default', 'light')],
    'refresh',
  )
  // The reusable cache hit still surfaces; the uncached variant is not scanned
  // because the driver could not launch — no flood of `unavailable` events.
  expect(results).toEqual(['foo/default/light'])
  await scanner.close()
})
