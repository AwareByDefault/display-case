import { describe, expect, test } from 'bun:test'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { makeTempDir } from '../testing/test-helpers'
import { pinReact } from './pin-react'

type OnResolveArgs = { path: string }
type OnResolveResult = { path: string }
type OnResolveCb = (args: OnResolveArgs) => OnResolveResult

/**
 * Drive the plugin without a real Bun build: capture the `onResolve` handler it
 * registers (and its filter), then invoke it directly.
 */
function captureOnResolve(pkgDir: string): {
  filter: RegExp
  run: OnResolveCb
} {
  const calls: Array<{ filter: RegExp; cb: OnResolveCb }> = []
  const build = {
    onResolve: (opts: { filter: RegExp }, cb: OnResolveCb) =>
      calls.push({ filter: opts.filter, cb }),
  }
  const plugin = pinReact(pkgDir)
  plugin.setup(build as unknown as Parameters<typeof plugin.setup>[0])
  if (!calls[0]) throw new Error('plugin registered no onResolve handler')
  return { filter: calls[0].filter, run: calls[0].cb }
}

describe('pinReact', () => {
  test('matches react / react-dom and their sub-paths, but not lookalikes', () => {
    const { filter } = captureOnResolve(process.cwd())
    for (const id of [
      'react',
      'react-dom',
      'react-dom/client',
      'react-dom/server',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
    ]) {
      expect(filter.test(id)).toBe(true)
    }
    // Unrelated packages that merely start with "react" must not be captured.
    for (const id of ['react-foo', 'react-router', '@scope/react', 'preact']) {
      expect(filter.test(id)).toBe(false)
    }
  })

  test('resolves every react specifier from the given pkgDir', () => {
    const dir = process.cwd()
    const { run } = captureOnResolve(dir)
    for (const id of [
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-runtime',
    ]) {
      expect(run({ path: id }).path).toBe(Bun.resolveSync(id, dir))
    }
  })

  test('throws a helpful error when react is not resolvable from pkgDir', async () => {
    const dir = await makeTempDir()
    try {
      const { run } = captureOnResolve(dir)
      expect(() => run({ path: 'react' })).toThrow(
        /Install react and react-dom/,
      )
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('bundles the render runtime and a hook component into one browser bundle', async () => {
    const dir = await makeTempDir()
    try {
      // The pairing that splits across two React copies without pinning: the
      // renderer (`react-dom/client`) plus a hook-using component. Bundling one
      // copy per resolved path, and pinning every specifier to a single pkgDir,
      // is what guarantees they share a React (proven by the resolution test
      // above); here we assert the plugin keeps a real build working end to end.
      const entry = join(dir, 'entry.tsx')
      await Bun.write(
        entry,
        [
          "import { createRoot } from 'react-dom/client'",
          "import { useState } from 'react'",
          'export function App() {',
          '  const [n] = useState(0)',
          '  return n',
          '}',
          'export { createRoot }',
        ].join('\n'),
      )
      const result = await Bun.build({
        entrypoints: [entry],
        target: 'browser',
        plugins: [pinReact(process.cwd())],
      })
      expect(result.success).toBe(true)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
