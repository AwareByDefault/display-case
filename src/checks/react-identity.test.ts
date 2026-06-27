import { afterEach, describe, expect, test } from 'bun:test'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { makeTempDir, writeFiles } from '../testing/test-helpers'
import {
  classifyReactEnvironment,
  faultFromSymptom,
  isReactDispatcherError,
  nearestReactDependant,
  type ReactEnvironmentInfo,
  type ReactLocation,
} from './react-identity'

const loc = (over: Partial<ReactLocation> = {}): ReactLocation => ({
  resolvedPath: '/repo/node_modules/react/index.js',
  packageDir: '/repo/node_modules/react',
  version: '19.2.6',
  resolveError: null,
  ...over,
})

const info = (
  over: Partial<ReactEnvironmentInfo> = {},
): ReactEnvironmentInfo => ({
  pkgDir: '/repo/packages/web',
  renderer: loc(),
  consumer: loc(),
  sameInstance: false,
  rendererFromTempPrefix: false,
  nearestReactDependant: '/repo/package.json',
  ...over,
})

describe('isReactDispatcherError', () => {
  test('matches the null-dispatcher signatures', () => {
    for (const msg of [
      "null is not an object (evaluating 'resolveDispatcher().useState')",
      'Invalid hook call. Hooks can only be called inside the body of a function component.',
      'Warning: You might have more than one copy of React in the same app.',
      "Cannot read properties of null (reading 'useRef')",
    ]) {
      expect(isReactDispatcherError(msg)).toBe(true)
    }
  })

  test('does not match genuine browser-API render failures', () => {
    for (const msg of [
      'window is not defined',
      "Can't find variable: document",
      'localStorage is not defined',
      'navigator is not defined',
    ]) {
      expect(isReactDispatcherError(msg)).toBe(false)
    }
  })
})

describe('classifyReactEnvironment', () => {
  test('no fault when the two Reacts are the same instance', () => {
    expect(classifyReactEnvironment(info({ sameInstance: true }))).toBeNull()
  })

  test('no fault when the split could not be proven (inconclusive)', () => {
    expect(classifyReactEnvironment(info({ sameInstance: null }))).toBeNull()
  })

  test('no fault when the consumer has no resolvable React (hook-free showcase)', () => {
    // A showcase of only hook-free cases needs no React; an unresolved consumer
    // React is inconclusive, never a fault.
    expect(
      classifyReactEnvironment(
        info({
          sameInstance: null,
          consumer: loc({
            resolvedPath: null,
            packageDir: null,
            version: null,
            resolveError: 'Cannot find module "react"',
          }),
        }),
      ),
    ).toBeNull()
  })

  test('bunx/temp renderer → bunx-temp-install, prescribes the nearest dependant', () => {
    const f = classifyReactEnvironment(
      info({
        rendererFromTempPrefix: true,
        renderer: loc({
          resolvedPath: '/tmp/bunx-501-x/node_modules/react/index.js',
          packageDir: '/tmp/bunx-501-x/node_modules/react',
        }),
      }),
    )
    expect(f?.kind).toBe('bunx-temp-install')
    expect(f?.summary).toMatch(/bunx\/temp install/)
    // Names both copies and the concrete file to edit.
    expect(f?.detail).toContain('/tmp/bunx-501-x/node_modules/react/index.js')
    expect(f?.detail).toContain(
      '@awarebydefault/display-case" to /repo/package.json',
    )
    // Does NOT push the user toward component edits.
    expect(f?.detail).toContain('do not move code into effects')
  })

  test('different versions → version-conflict, names both versions', () => {
    const f = classifyReactEnvironment(
      info({
        renderer: loc({ version: '18.3.1' }),
        consumer: loc({ version: '19.2.6' }),
      }),
    )
    expect(f?.kind).toBe('version-conflict')
    expect(f?.summary).toContain('18.3.1')
    expect(f?.summary).toContain('19.2.6')
    expect(f?.detail).toMatch(/align the React versions/)
  })

  test('same version, different node_modules → duplicate-install', () => {
    const f = classifyReactEnvironment(
      info({
        renderer: loc({
          resolvedPath: '/repo/node_modules/react/index.js',
        }),
        consumer: loc({
          resolvedPath: '/repo/packages/web/node_modules/react/index.js',
        }),
      }),
    )
    expect(f?.kind).toBe('duplicate-install')
    expect(f?.summary).toContain('react@19.2.6')
    expect(f?.detail).toContain('@awarebydefault/display-case')
  })

  test('falls back to pkgDir/package.json when no ancestor declares react', () => {
    const f = classifyReactEnvironment(
      info({ rendererFromTempPrefix: true, nearestReactDependant: null }),
    )
    expect(f?.detail).toContain(
      '@awarebydefault/display-case" to /repo/packages/web/package.json',
    )
  })
})

describe('faultFromSymptom', () => {
  test('forces a classification even from an otherwise no-fault info', () => {
    const f = faultFromSymptom(info({ sameInstance: null }))
    expect(f.kind).toBe('duplicate-install')
    expect(f.detail).toContain('do not move code into effects')
  })

  test('still names the environment fault when versions are unknown', () => {
    const f = faultFromSymptom({
      pkgDir: '/repo/pkg',
      renderer: loc({ resolvedPath: null, packageDir: null, version: null }),
      consumer: loc({ resolvedPath: null, packageDir: null, version: null }),
      sameInstance: null,
      rendererFromTempPrefix: false,
      nearestReactDependant: null,
    })
    // Still an environment fault (never a per-component bug), and steers the
    // user away from component edits even without precise version detail.
    expect(f.kind).toBe('duplicate-install')
    expect(f.detail).toContain('do not move code into effects')
    expect(f.detail).toContain('/repo/pkg/package.json')
  })
})

describe('nearestReactDependant', () => {
  const dirs: string[] = []
  afterEach(async () => {
    while (dirs.length)
      await rm(dirs.pop() as string, { recursive: true, force: true })
  })

  test('finds the nearest ancestor package.json that depends on react', async () => {
    const root = await makeTempDir()
    dirs.push(root)
    await writeFiles(root, {
      'package.json': JSON.stringify({
        name: 'root',
        dependencies: { react: '^19' },
      }),
      'packages/web/package.json': JSON.stringify({
        name: 'web',
        devDependencies: { typescript: '^5' },
      }),
      'packages/web/src/.keep': '',
    })
    const found = nearestReactDependant(join(root, 'packages/web/src'))
    expect(found).toBe(join(root, 'package.json'))
  })

  test('matches a peerDependency too', async () => {
    const root = await makeTempDir()
    dirs.push(root)
    await writeFiles(root, {
      'package.json': JSON.stringify({
        name: 'lib',
        peerDependencies: { react: '>=18' },
      }),
    })
    expect(nearestReactDependant(root)).toBe(join(root, 'package.json'))
  })

  test('returns null when no ancestor depends on react', async () => {
    const root = await makeTempDir()
    dirs.push(root)
    await writeFiles(root, {
      'package.json': JSON.stringify({ name: 'x', dependencies: {} }),
    })
    // A nested dir whose only package.json (the temp root's) lacks react. The
    // walk may continue above the temp dir, but no ancestor of a fresh temp
    // tree declares react, so the result is null.
    expect(nearestReactDependant(root)).toBeNull()
  })
})
