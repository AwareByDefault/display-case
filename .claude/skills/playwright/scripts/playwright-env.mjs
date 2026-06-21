// Playwright environment helper for this repo.
//
// Why this exists: `playwright` is declared only as an optionalDependency of
// `packages/display-case`, so a bare `import 'playwright'` resolves ONLY for
// scripts that physically live under that package. Any script elsewhere in the
// repo fails with "Cannot find package 'playwright'". On top of that,
// Playwright's default headless-shell channel can drift from the browser build
// actually present in the cache, so `chromium.launch()` may hunt for a missing
// executable.
//
// This module solves both, with no developer-specific hard-coded paths:
//   - loads Playwright via createRequire anchored at the package that owns it,
//   - resolves a real, installed browser binary and pins it as executablePath.
//
// Usage (from any script anywhere in the repo):
//   import { launchChromium } from '<path>/playwright-env.mjs'
//   const browser = await launchChromium()            // headless by default
//   const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
//   ...
//   await browser.close()

import { existsSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import path from 'node:path'

// --- 1. Locate the repo root (nearest ancestor containing a `.git`) ---------
function findRepoRoot(start) {
  let dir = start
  for (;;) {
    if (existsSync(path.join(dir, '.git'))) return dir
    const parent = path.dirname(dir)
    if (parent === dir) return start // fell off the top — best effort
    dir = parent
  }
}
const REPO = findRepoRoot(import.meta.dirname)

// --- 2. Import Playwright from wherever the repo installed it ----------------
function loadPlaywright() {
  const anchors = [
    path.join(REPO, 'packages/display-case/package.json'), // declared here
    path.join(REPO, 'package.json'), // in case it gets hoisted/added at root
  ]
  for (const anchor of anchors) {
    if (!existsSync(anchor)) continue
    try {
      return createRequire(anchor)('playwright')
    } catch {
      // try the next anchor
    }
  }
  throw new Error(
    'Playwright is not installed. Install it in the package that owns it:\n' +
      '  cd packages/display-case && bun install\n' +
      'Then download a browser:\n' +
      '  cd packages/display-case && bunx playwright install chromium',
  )
}

const pw = loadPlaywright()
export const { chromium, firefox, webkit, devices } = pw

// --- 3. Resolve a real browser binary (no hard-coded user path) -------------
function browserCacheRoot() {
  if (process.env.PLAYWRIGHT_BROWSERS_PATH)
    return process.env.PLAYWRIGHT_BROWSERS_PATH
  const home = homedir()
  if (process.platform === 'darwin')
    return path.join(home, 'Library/Caches/ms-playwright')
  if (process.platform === 'win32')
    return path.join(home, 'AppData/Local/ms-playwright')
  return path.join(home, '.cache/ms-playwright')
}

// Fallback: scan the Playwright browser cache for any installed Chromium build.
// Prefers the lighter headless shell, then the highest build number.
function scanCacheForChromium() {
  const root = browserCacheRoot()
  if (!existsSync(root)) return null
  const wanted = new Set([
    'chrome-headless-shell',
    'chrome-headless-shell.exe',
    'Google Chrome for Testing',
    'Chromium',
    'chrome',
    'chrome.exe',
  ])
  const hits = []
  const walk = (dir, depth) => {
    if (depth > 6) return
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const full = path.join(dir, e.name)
      if (e.isDirectory()) walk(full, depth + 1)
      else if (wanted.has(e.name)) hits.push(full)
    }
  }
  walk(root, 0)
  if (!hits.length) return null
  const score = (p) => {
    const shell = /headless-shell/.test(p) ? 1e9 : 0
    const top = path.relative(root, p).split(path.sep)[0]
    const m = top.match(/-(\d+)$/)
    return shell + (m ? Number(m[1]) : 0)
  }
  hits.sort((a, b) => score(b) - score(a))
  return hits[0]
}

/**
 * Absolute path to a Chromium executable Playwright can launch.
 * Order: Playwright's own (installed) browser → newest build in the cache.
 * Throws with an install hint if none is found.
 */
export function resolveChromiumPath() {
  try {
    const p = chromium.executablePath()
    if (p && existsSync(p)) return p
  } catch {
    // executablePath() can throw if the registry is unavailable — fall through
  }
  const scanned = scanCacheForChromium()
  if (scanned) return scanned
  throw new Error(
    'No Chromium build found for Playwright. Install one with:\n' +
      '  cd packages/display-case && bunx playwright install chromium',
  )
}

/** Launch Chromium with an explicit, verified executable (headless by default). */
export function launchChromium(opts = {}) {
  return chromium.launch({ executablePath: resolveChromiumPath(), ...opts })
}
