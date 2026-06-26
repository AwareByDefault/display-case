import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, rm, symlink } from 'node:fs/promises'
import { join } from 'node:path'
import type { HierarchyLevel, StructureRuleId } from '../index'
import { makeTempDir, writeFiles } from '../testing/test-helpers'
import { checkStructure } from './structure-check'

/**
 * Full cross-package coverage for the composition level-resolver.
 *
 * Each test builds two dummy Display-Case "repositories" in a temp dir — a
 * shared library and a consumer app — and links the library into the app's
 * `node_modules` so the bare specifier `@dc-fixture/lib` resolves exactly as it
 * would in a real workspace. The app's component imports from the library, so
 * the resolver must (1) resolve the bare specifier to the library package, (2)
 * recognize it as a showcase, (3) follow its barrel re-export to the component
 * file, and (4) read that component's declared level. Raw case-module objects
 * are used so the fixtures need no `display-case` import to load.
 */

const ALL_RULES: StructureRuleId[] = [
  'case-placard-coverage',
  'no-orphaned-placard-doc',
  'primer-present-and-used',
  'setup-present',
  'config-paths-exist',
  'levels-classified',
  'cases-load',
  'flow-transitions-resolve',
  'flow-multi-step',
  'unique-slugs',
  'tweak-defaults-valid',
  'atom-purity',
  'no-downward-dependency',
  'composes-lower-level',
  'level-fit',
]

// App config enabling only the rule under test (so cross-package findings are
// isolated from the default-on rules the bare fixtures would otherwise trip).
const appConfig = (rule: StructureRuleId) => {
  const rules = ALL_RULES.map(
    (id) => `'${id}': ${id === rule ? '{}' : 'false'}`,
  ).join(', ')
  return `export default { title:'App', roots:['src/**/*.case.tsx'], check:{ structure:{ rules:{ ${rules} } } } }\n`
}

const caseModule = (component: string, level: HierarchyLevel) =>
  `export default { component:'${component}', cases:{}, isFlow:false, level:'${level}' }\n`

interface ReposOpts {
  libLevel: HierarchyLevel
  appLevel: HierarchyLevel
  /** 'named' ⇒ followable `export { X } from`; 'star' ⇒ unfollowable `export *`. */
  barrel: 'named' | 'star'
  rule: StructureRuleId
}

describe('checkStructure cross-package resolution', () => {
  const dirs: string[] = []

  // Build the lib + app repos and link lib into app/node_modules. Returns appDir.
  const setupRepos = async (o: ReposOpts): Promise<string> => {
    const root = await makeTempDir()
    dirs.push(root)
    const libDir = join(root, 'lib')
    const appDir = join(root, 'app')

    const barrel =
      o.barrel === 'named'
        ? `export { LibThing } from './thing'\n`
        : `export * from './thing'\n`

    await writeFiles(libDir, {
      'package.json': JSON.stringify({
        name: '@dc-fixture/lib',
        type: 'module',
        main: './src/index.ts',
        exports: { '.': './src/index.ts' },
      }),
      'display-case.config.ts': `export default { title:'Lib', roots:['src/**/*.case.tsx'] }\n`,
      'src/index.ts': barrel,
      'src/thing.tsx': 'export const LibThing = () => null\n',
      'src/thing.case.tsx': caseModule('LibThing', o.libLevel),
    })

    await writeFiles(appDir, {
      'package.json': JSON.stringify({
        name: '@dc-fixture/app',
        type: 'module',
      }),
      'display-case.config.ts': appConfig(o.rule),
      'src/cmp.tsx': `import { LibThing } from '@dc-fixture/lib'\nexport const Cmp = () => LibThing\n`,
      'src/cmp.case.tsx': caseModule('Cmp', o.appLevel),
    })

    // Link the library into the app's node_modules so the bare specifier resolves.
    await mkdir(join(appDir, 'node_modules', '@dc-fixture'), {
      recursive: true,
    })
    await symlink(
      libDir,
      join(appDir, 'node_modules', '@dc-fixture', 'lib'),
      'dir',
    )

    return appDir
  }

  const findings = async (appDir: string, rule: StructureRuleId) =>
    (await checkStructure(appDir)).findings.filter((f) => f.rule === rule)

  afterEach(async () => {
    while (dirs.length)
      await rm(dirs.pop() as string, { recursive: true, force: true })
  })

  test('composes-lower-level is satisfied by a lower-level component from another showcase', async () => {
    const app = await setupRepos({
      libLevel: 'atom',
      appLevel: 'molecule',
      barrel: 'named',
      rule: 'composes-lower-level',
    })
    // The molecule composes nothing locally; only the cross-package atom can
    // satisfy the rule, so zero findings proves the resolver followed it.
    expect(await findings(app, 'composes-lower-level')).toHaveLength(0)
  })

  test('an organism composed only of a foreign atom passes', async () => {
    const app = await setupRepos({
      libLevel: 'atom',
      appLevel: 'organism',
      barrel: 'named',
      rule: 'composes-lower-level',
    })
    expect(await findings(app, 'composes-lower-level')).toHaveLength(0)
  })

  test('no-downward-dependency catches a higher-level component from another showcase', async () => {
    const app = await setupRepos({
      libLevel: 'organism',
      appLevel: 'atom',
      barrel: 'named',
      rule: 'no-downward-dependency',
    })
    const f = await findings(app, 'no-downward-dependency')
    expect(f).toHaveLength(1)
    expect(f[0]!.severity).toBe('error')
    expect(f[0]!.message).toContain('organism')
  })

  test('an unfollowable workspace-showcase import warns, not errors', async () => {
    const app = await setupRepos({
      libLevel: 'atom',
      appLevel: 'molecule',
      barrel: 'star', // `export *` — the resolver cannot bind the name to a file
      rule: 'composes-lower-level',
    })
    const f = await findings(app, 'composes-lower-level')
    expect(f).toHaveLength(1)
    expect(f[0]!.severity).toBe('warn')
    expect(f[0]!.message).toContain('could not be resolved')
  })
})
