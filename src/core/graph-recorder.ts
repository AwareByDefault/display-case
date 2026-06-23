import { existsSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import type { BunPlugin } from 'bun'

/**
 * Bun bundler plugin that records the absolute path of every on-disk file the
 * build actually loads — the real module graph, transitive imports included.
 *
 * Why: the dev watcher's directory subscriptions only cover the target package's
 * `src` (and, in `--dev`, Display Case's own UI). A workspace sibling resolved to
 * its **source** (via an `exports`/`main` that points at `./src/index.ts`, with
 * no build step) is a first-class bundle input but lives outside those dirs, so
 * editing it never triggers a rebuild and the served bundle goes stale silently.
 * Feeding this set to the watcher lets it follow the bundler's actual inputs
 * rather than a fixed directory — source-resolved workspace deps included.
 *
 * It hooks `onLoad` with a catch-all filter and returns `undefined`, so it only
 * observes: the load falls through to the default loader (or another plugin's
 * `onLoad`). Register it **first** in the plugin list so paths another plugin
 * ultimately handles (e.g. the MDX plugin's `.mdx`) are still recorded.
 */
export function graphRecorder(into: Set<string>): BunPlugin {
  return {
    name: 'display-case-graph-recorder',
    setup(build) {
      build.onLoad({ filter: /.*/ }, (args) => {
        into.add(args.path)
        return undefined
      })
    },
  }
}

/** Whether `child` is `parent` itself or nested beneath it. */
function isInside(child: string, parent: string): boolean {
  return child === parent || child.startsWith(parent + sep)
}

/**
 * Walk up from a file to the nearest ancestor directory holding a `package.json`
 * — the owning package — stopping at (and including) `repoRoot`. Null if none is
 * found within the repo. Used to collapse a sibling's many graph inputs to a
 * single watch on its package source.
 */
function nearestPackageDir(file: string, repoRoot: string): string | null {
  let dir = dirname(file)
  for (let i = 0; i < 24; i++) {
    if (existsSync(join(dir, 'package.json'))) return dir
    if (dir === repoRoot) break
    const parent = resolve(dir, '..')
    if (parent === dir) break
    dir = parent
  }
  return null
}

/**
 * The root that bounds the dependency watch — the target's monorepo/workspace
 * root, *not* wherever Display Case itself is installed. Prefer the nearest
 * ancestor with a `.git` (the conventional repo root); absent that, the topmost
 * ancestor still holding a `package.json` (a workspace root in a checkout with no
 * `.git`); failing both, the package dir itself. Only source within this root is
 * eligible to be watched, and the walk for an input's owning package stops here.
 */
export function findWatchRoot(pkgDir: string): string {
  let dir = resolve(pkgDir)
  let topPkg = dir
  for (let i = 0; i < 24; i++) {
    if (existsSync(join(dir, '.git'))) return dir
    if (existsSync(join(dir, 'package.json'))) topPkg = dir
    const parent = resolve(dir, '..')
    if (parent === dir) break
    dir = parent
  }
  return topPkg
}

export interface WatchDirOptions {
  /** The target package's source dir — already watched, so excluded. */
  srcDir: string
  /** Display Case's own UI root — owned by the `--dev` watch path, so excluded. */
  hereDir: string
  /** The target's workspace root (see findWatchRoot): inputs must live under it,
   *  and the walk for an owning package stops here. */
  repoRoot: string
}

/**
 * Derive the directories to watch from a bundle's real module graph (the set a
 * `graphRecorder` collected). Each input file outside the target's own `src`
 * (and Display Case's UI) maps to its owning package, collapsed to that package's
 * `src` when present. This is what picks up a workspace sibling resolved to
 * source — its edits become first-class rebuild triggers, not silent staleness.
 *
 * Excluded: installed deps (`node_modules`), files outside the repo, files
 * already covered by the `srcDir`/`hereDir` subscriptions, and any candidate dir
 * that would *widen* coverage back over those (a package whose root is an
 * ancestor of the target's src).
 */
export function graphWatchDirs(
  paths: Iterable<string>,
  opts: WatchDirOptions,
): Set<string> {
  const srcDir = resolve(opts.srcDir)
  const hereDir = resolve(opts.hereDir)
  const repoRoot = resolve(opts.repoRoot)
  const repoPrefix = repoRoot + sep
  const nm = `${sep}node_modules${sep}`
  const dirs = new Set<string>()
  for (const file of paths) {
    const abs = resolve(file)
    if (abs.includes(nm)) continue // installed deps: not editable source
    if (!abs.startsWith(repoPrefix)) continue // outside the repo
    if (isInside(abs, srcDir)) continue // already covered by the src watch
    if (isInside(abs, hereDir)) continue // owned by the watchHere path
    const pkg = nearestPackageDir(abs, repoRoot)
    if (!pkg) continue
    const candidate = join(pkg, 'src')
    const watchDir =
      existsSync(candidate) && isInside(abs, candidate) ? candidate : pkg
    // Never widen the watch to a dir that would also cover the target's src or
    // Display Case's UI — those have their own (narrower) subscriptions.
    if (isInside(srcDir, watchDir) || isInside(hereDir, watchDir)) continue
    dirs.add(watchDir)
  }
  return dirs
}
