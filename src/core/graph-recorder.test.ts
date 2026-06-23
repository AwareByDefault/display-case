import { afterEach, describe, expect, test } from 'bun:test'
import { realpathSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { makeTempDir, writeFiles } from '../testing/test-helpers'
import { findWatchRoot, graphRecorder, graphWatchDirs } from './graph-recorder'

const dirs: string[] = []
const setup = async (files: Record<string, string>) => {
  // realpath so the dir matches the canonical paths Bun's bundler records
  // (macOS resolves the tmp `/var/...` symlink to `/private/var/...`).
  const dir = realpathSync(await makeTempDir())
  dirs.push(dir)
  await writeFiles(dir, files)
  return dir
}

afterEach(async () => {
  while (dirs.length)
    await rm(dirs.pop() as string, { recursive: true, force: true })
})

describe('graphRecorder', () => {
  test('records every on-disk file the build actually loads, transitively', async () => {
    const dir = await setup({
      'entry.ts': `import { b } from './nested/b.ts'\nexport const a = b + 1\n`,
      'nested/b.ts': `import { c } from './c.ts'\nexport const b = c\n`,
      'nested/c.ts': `export const c = 41\n`,
    })
    const inputs = new Set<string>()
    const result = await Bun.build({
      entrypoints: [join(dir, 'entry.ts')],
      plugins: [graphRecorder(inputs)],
    })
    expect(result.success).toBe(true)
    expect(inputs).toEqual(
      new Set([
        join(dir, 'entry.ts'),
        join(dir, 'nested/b.ts'),
        join(dir, 'nested/c.ts'),
      ]),
    )
  })

  test('still records a path another plugin ultimately handles', async () => {
    const dir = await setup({
      'entry.ts': `import { v } from './data.fake'\nexport const a = v\n`,
      'data.fake': `NOT JS\n`,
    })
    const inputs = new Set<string>()
    const fake = {
      name: 'fake',
      setup(build: Bun.PluginBuilder) {
        build.onLoad({ filter: /\.fake$/ }, () => ({
          contents: 'export const v = 7',
          loader: 'js' as const,
        }))
      },
    }
    // Recorder registered first; it returns undefined so `fake` still handles it.
    const result = await Bun.build({
      entrypoints: [join(dir, 'entry.ts')],
      plugins: [graphRecorder(inputs), fake],
    })
    expect(result.success).toBe(true)
    expect(inputs.has(join(dir, 'data.fake'))).toBe(true)
  })
})

describe('graphWatchDirs', () => {
  // A monorepo where the target app consumes a workspace sibling resolved to its
  // source (no build step), the exact topology from the bug report.
  const monorepo = async () =>
    setup({
      'package.json': `{ "name": "root", "workspaces": ["apps/*", "packages/*"] }\n`,
      'apps/web/package.json': `{ "name": "web" }\n`,
      'apps/web/src/App.tsx': `export const App = () => null\n`,
      'packages/sibling/package.json': `{ "name": "sibling", "exports": { ".": "./src/index.ts" } }\n`,
      'packages/sibling/src/index.ts': `export const x = 1\n`,
      'packages/sibling/src/components/widget.tsx': `export const W = () => null\n`,
    })

  test('maps a source-resolved sibling to its package src dir', async () => {
    const repo = await monorepo()
    const opts = {
      srcDir: join(repo, 'apps/web/src'),
      hereDir: join(repo, 'node_modules/display-case'),
      repoRoot: repo,
    }
    const dirs = graphWatchDirs(
      [
        // target's own source — already watched, excluded
        join(repo, 'apps/web/src/App.tsx'),
        // sibling source — the inputs that must produce a watch
        join(repo, 'packages/sibling/src/index.ts'),
        join(repo, 'packages/sibling/src/components/widget.tsx'),
        // an installed dep — excluded
        join(repo, 'node_modules/react/index.js'),
        // outside the repo — excluded
        '/elsewhere/lib/thing.ts',
      ],
      opts,
    )
    expect(dirs).toEqual(new Set([join(repo, 'packages/sibling/src')]))
  })

  test('falls back to the package root when it has no src dir', async () => {
    const repo = await monorepo()
    await writeFiles(repo, {
      'packages/flat/package.json': `{ "name": "flat" }\n`,
      'packages/flat/index.ts': `export const y = 2\n`,
    })
    const dirs = graphWatchDirs([join(repo, 'packages/flat/index.ts')], {
      srcDir: join(repo, 'apps/web/src'),
      hereDir: join(repo, 'node_modules/display-case'),
      repoRoot: repo,
    })
    expect(dirs).toEqual(new Set([join(repo, 'packages/flat')]))
  })

  test('bounds the watch by the target workspace root, not the cwd', async () => {
    // Without findWatchRoot the search would bound by wherever Display Case
    // itself lives; the sibling — in the *target's* repo — would fall outside it.
    const repo = await monorepo()
    const watchRoot = findWatchRoot(join(repo, 'apps/web'))
    expect(watchRoot).toBe(repo) // the topmost package.json (no .git in fixture)
    const dirs = graphWatchDirs([join(repo, 'packages/sibling/src/index.ts')], {
      srcDir: join(repo, 'apps/web/src'),
      hereDir: '/somewhere/else/display-case/src',
      repoRoot: watchRoot,
    })
    expect(dirs).toEqual(new Set([join(repo, 'packages/sibling/src')]))
  })

  test('excludes files under Display Case’s own UI (the dev path owns them)', async () => {
    const repo = await monorepo()
    const dirs = graphWatchDirs(
      [join(repo, 'display-case/src/ui/render-mount.tsx')],
      {
        srcDir: join(repo, 'apps/web/src'),
        hereDir: join(repo, 'display-case/src'),
        repoRoot: repo,
      },
    )
    expect(dirs.size).toBe(0)
  })
})
