import { afterEach, describe, expect, test } from 'bun:test'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { StructureRuleId } from '../index'
import { makeTempDir, writeFiles } from '../testing/test-helpers'
import { checkStructure, type StructureFinding } from './structure-check'

// Case fixtures import the real authoring helpers by absolute path so they load
// from a temp dir outside the workspace's module resolution.
const DC = join(import.meta.dir, '..', 'index.ts')
const caseFile = (body: string) =>
  `import { defineCases, defineFlow, tweak } from '${DC}'\nexport default ${body}\n`

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
  'nav-groups-resolve',
  'interactive-cases-keyed',
  'atom-purity',
  'no-downward-dependency',
  'composes-lower-level',
  'level-fit',
]

// Build a config that enables only the named rules (others disabled), so each
// test sees findings from its rule alone. `enabled[id]`: true ⇒ default severity,
// or a severity string. `extra` splices extra config fields (leading comma).
function config(
  enabled: Partial<Record<StructureRuleId, true | 'warn' | 'error'>>,
  extra = '',
): string {
  const rules = ALL_RULES.map((id) => {
    if (!(id in enabled)) return `'${id}': false`
    const v = enabled[id]
    return `'${id}': ${v === true ? '{}' : `'${v}'`}`
  }).join(', ')
  return `export default { title: 'F', roots: ['**/*.case.tsx'], check: { structure: { rules: { ${rules} } } }${extra} }\n`
}

describe('checkStructure', () => {
  const dirs: string[] = []
  const setup = async (files: Record<string, string>) => {
    const dir = await makeTempDir()
    dirs.push(dir)
    await writeFiles(dir, files)
    return dir
  }
  const run = async (dir: string, opts = {}) =>
    (await checkStructure(dir, opts)).findings
  const only = (findings: StructureFinding[], rule: StructureRuleId) =>
    findings.filter((f) => f.rule === rule)

  afterEach(async () => {
    while (dirs.length)
      await rm(dirs.pop() as string, { recursive: true, force: true })
  })

  // ── case-placard-coverage ──────────────────────────────────────────────────

  test('coverage: flags a component missing its placard doc', async () => {
    const dir = await setup({
      'display-case.config.ts': config({ 'case-placard-coverage': true }),
      'Button.tsx': 'export const Button = () => null\n',
      'Button.case.tsx': caseFile(
        `defineCases('Button', {}, { level: 'atom' })`,
      ),
    })
    const f = only(await run(dir), 'case-placard-coverage')
    expect(f).toHaveLength(1)
    expect(f[0]!.message).toContain('*.placard.md')
  })

  test('coverage: flags a component missing its case', async () => {
    const dir = await setup({
      'display-case.config.ts': config({ 'case-placard-coverage': true }),
      'Widget.tsx': 'export const Widget = () => null\n',
      'Widget.placard.md': '# Widget\n',
    })
    const f = only(await run(dir), 'case-placard-coverage')
    expect(f).toHaveLength(1)
    expect(f[0]!.message).toContain('*.case.tsx')
  })

  test('coverage: passes when case and prompt both present', async () => {
    const dir = await setup({
      'display-case.config.ts': config({ 'case-placard-coverage': true }),
      'Button.tsx': 'export const Button = () => null\n',
      'Button.case.tsx': caseFile(
        `defineCases('Button', {}, { level: 'atom' })`,
      ),
      'Button.placard.md': '# Button\n',
    })
    expect(only(await run(dir), 'case-placard-coverage')).toHaveLength(0)
  })

  test('coverage: a no-placard marker exempts the component', async () => {
    const dir = await setup({
      'display-case.config.ts': config({ 'case-placard-coverage': true }),
      'Button.tsx':
        '// display-case: no-placard internal\nexport const Button = () => null\n',
      'Button.case.tsx': caseFile(
        `defineCases('Button', {}, { level: 'atom' })`,
      ),
    })
    expect(only(await run(dir), 'case-placard-coverage')).toHaveLength(0)
  })

  test('coverage: a no-case marker fully exempts a non-component module', async () => {
    const dir = await setup({
      'display-case.config.ts': config({ 'case-placard-coverage': true }),
      'fixtures.tsx':
        '// display-case: no-case shared fixtures\nexport const data = 1\n',
    })
    expect(only(await run(dir), 'case-placard-coverage')).toHaveLength(0)
  })

  test('coverage: config ignore exempts matching paths', async () => {
    const dir = await setup({
      'display-case.config.ts': config({
        'case-placard-coverage': true,
      }).replace(
        `'case-placard-coverage': {}`,
        `'case-placard-coverage': { ignore: ['Button.tsx'] }`,
      ),
      'Button.tsx': 'export const Button = () => null\n',
      'Button.case.tsx': caseFile(
        `defineCases('Button', {}, { level: 'atom' })`,
      ),
    })
    expect(only(await run(dir), 'case-placard-coverage')).toHaveLength(0)
  })

  // ── no-orphaned-placard-doc ────────────────────────────────────────────────

  test('orphan: flags a placard doc with no case', async () => {
    const dir = await setup({
      'display-case.config.ts': config({ 'no-orphaned-placard-doc': true }),
      'Lonely.placard.md': '# Lonely\n',
    })
    expect(only(await run(dir), 'no-orphaned-placard-doc')).toHaveLength(1)
  })

  test('orphan: passes with a sibling case (no component module needed)', async () => {
    const dir = await setup({
      'display-case.config.ts': config({ 'no-orphaned-placard-doc': true }),
      'Lonely.placard.md': '# Lonely\n',
      'Lonely.case.tsx': caseFile(
        `defineCases('Lonely', {}, { level: 'atom' })`,
      ),
    })
    expect(only(await run(dir), 'no-orphaned-placard-doc')).toHaveLength(0)
  })

  test('orphan: an allow-orphan marker exempts the doc', async () => {
    const dir = await setup({
      'display-case.config.ts': config({ 'no-orphaned-placard-doc': true }),
      'Lonely.placard.md':
        '<!-- display-case: allow-orphan legacy -->\n# Lonely\n',
    })
    expect(only(await run(dir), 'no-orphaned-placard-doc')).toHaveLength(0)
  })

  // ── config-paths-exist ────────────────────────────────────────────────────

  test('config-paths: flags a missing globalStyles entry', async () => {
    const dir = await setup({
      'display-case.config.ts': config(
        { 'config-paths-exist': true },
        `, globalStyles: ['missing.css']`,
      ),
    })
    expect(only(await run(dir), 'config-paths-exist')).toHaveLength(1)
  })

  test('config-paths: passes when the file exists', async () => {
    const dir = await setup({
      'display-case.config.ts': config(
        { 'config-paths-exist': true },
        `, globalStyles: ['tokens.css']`,
      ),
      'tokens.css': ':root{}',
    })
    expect(only(await run(dir), 'config-paths-exist')).toHaveLength(0)
  })

  test('config-paths: flags a baselineDir that points at a file', async () => {
    const dir = await setup({
      'display-case.config.ts': config(
        { 'config-paths-exist': true },
        `, baselineDir: 'baselines'`,
      ),
      // `baselines` is a file, not the expected directory.
      baselines: 'oops, a file\n',
    })
    const f = only(await run(dir), 'config-paths-exist')
    expect(f).toHaveLength(1)
    expect(f[0]!.message).toContain('not a directory')
  })

  test('config-paths: a not-yet-created baselineDir is fine', async () => {
    const dir = await setup({
      // Nothing recorded yet ⇒ the dir is absent; that is not a violation.
      'display-case.config.ts': config(
        { 'config-paths-exist': true },
        `, baselineDir: 'baselines'`,
      ),
    })
    expect(only(await run(dir), 'config-paths-exist')).toHaveLength(0)
  })

  // ── setup-present ──────────────────────────────────────────────────────────

  test('setup: flags a missing default toolchain', async () => {
    const dir = await setup({
      'display-case.config.ts': config({ 'setup-present': true }),
    })
    // Point the tooling probe at the toolchain-free fixture too, so neither
    // location resolves it — the genuinely-missing case.
    expect(
      only(await run(dir, { toolingDir: dir }), 'setup-present'),
    ).toHaveLength(1)
  })

  test('setup: passes when the toolchain resolves via the display-case tooling', async () => {
    const dir = await setup({
      'display-case.config.ts': config({ 'setup-present': true }),
    })
    // Default toolingDir is the display-case package, which carries the toolchain
    // (as the visual backend resolves it). The consumer dir has none, yet the
    // setup is present — proving the second probe location.
    expect(only(await run(dir), 'setup-present')).toHaveLength(0)
  })

  test('setup: passes when a custom provider is configured', async () => {
    const dir = await setup({
      'display-case.config.ts': config(
        { 'setup-present': true },
        `, providers: { diff: () => ({ changed: false }) }`,
      ),
    })
    expect(
      only(await run(dir, { toolingDir: dir }), 'setup-present'),
    ).toHaveLength(0)
  })

  // ── primer-present-and-used ──────────────────────────────────────────────

  test('primer: flags an unconfigured primer', async () => {
    const dir = await setup({
      'display-case.config.ts': config({ 'primer-present-and-used': true }),
    })
    const f = only(await run(dir), 'primer-present-and-used')
    expect(f).toHaveLength(1)
    expect(f[0]!.message).toContain('no primer')
  })

  test('primer: flags a primer with no Display specimen', async () => {
    const dir = await setup({
      'display-case.config.ts': config(
        { 'primer-present-and-used': true },
        `, primer: './primer.mdx'`,
      ),
      'primer.mdx': '# Wall text\n\nJust prose, no specimens.\n',
    })
    const f = only(await run(dir), 'primer-present-and-used')
    expect(f).toHaveLength(1)
    expect(f[0]!.message).toContain('<Display>')
  })

  test('primer: passes with prose and a Display specimen', async () => {
    const dir = await setup({
      'display-case.config.ts': config(
        { 'primer-present-and-used': true },
        `, primer: './primer.mdx'`,
      ),
      'primer.mdx':
        '# Wall text\n\nSome prose here.\n\n<Display title="x"><Button /></Display>\n',
    })
    expect(only(await run(dir), 'primer-present-and-used')).toHaveLength(0)
  })

  // ── levels-classified ─────────────────────────────────────────────────────

  test('levels: flags an unclassified component', async () => {
    const dir = await setup({
      'display-case.config.ts': config({ 'levels-classified': true }),
      'X.case.tsx': caseFile(`defineCases('X', { Default: () => null })`),
    })
    expect(only(await run(dir), 'levels-classified')).toHaveLength(1)
  })

  test('levels: passes when a level is declared', async () => {
    const dir = await setup({
      'display-case.config.ts': config({ 'levels-classified': true }),
      'X.case.tsx': caseFile(
        `defineCases('X', { Default: () => null }, { level: 'atom' })`,
      ),
    })
    expect(only(await run(dir), 'levels-classified')).toHaveLength(0)
  })

  test('levels: an unclassified marker exempts the case', async () => {
    const dir = await setup({
      'display-case.config.ts': config({ 'levels-classified': true }),
      'X.case.tsx': `// display-case: unclassified wip\n${caseFile(`defineCases('X', { Default: () => null })`)}`,
    })
    expect(only(await run(dir), 'levels-classified')).toHaveLength(0)
  })

  // ── cases-load ─────────────────────────────────────────────────────────────

  test('cases-load: flags a malformed case file', async () => {
    const dir = await setup({
      'display-case.config.ts': config({ 'cases-load': true }),
      'Bad.case.tsx': `export default { not: 'a case module' }\n`,
    })
    expect(only(await run(dir), 'cases-load')).toHaveLength(1)
  })

  // ── flow rules ─────────────────────────────────────────────────────────────

  test('flow-transitions: flags a transition to a missing step', async () => {
    const dir = await setup({
      'display-case.config.ts': config({ 'flow-transitions-resolve': true }),
      'F.case.tsx': caseFile(
        `defineFlow('F', { steps: { A: { transitions: ['Nope'], render: () => null }, B: { render: () => null } } })`,
      ),
    })
    expect(only(await run(dir), 'flow-transitions-resolve')).toHaveLength(1)
  })

  test('flow-transitions: passes when targets exist', async () => {
    const dir = await setup({
      'display-case.config.ts': config({ 'flow-transitions-resolve': true }),
      'F.case.tsx': caseFile(
        `defineFlow('F', { steps: { A: { transitions: ['B'], render: () => null }, B: { render: () => null } } })`,
      ),
    })
    expect(only(await run(dir), 'flow-transitions-resolve')).toHaveLength(0)
  })

  test('flow-multi-step: flags a single-step flow', async () => {
    const dir = await setup({
      'display-case.config.ts': config({ 'flow-multi-step': true }),
      'F.case.tsx': caseFile(
        `defineFlow('F', { steps: { Only: { render: () => null } } })`,
      ),
    })
    expect(only(await run(dir), 'flow-multi-step')).toHaveLength(1)
  })

  // ── unique-slugs ───────────────────────────────────────────────────────────

  test('unique-slugs: flags two components colliding on slug', async () => {
    const dir = await setup({
      'display-case.config.ts': config({ 'unique-slugs': true }),
      'A.case.tsx': caseFile(`defineCases('Sign in', {}, { level: 'page' })`),
      'B.case.tsx': caseFile(`defineCases('Sign-in', {}, { level: 'page' })`),
    })
    expect(only(await run(dir), 'unique-slugs')).toHaveLength(1)
  })

  test('unique-slugs: flags cases colliding within a component', async () => {
    const dir = await setup({
      'display-case.config.ts': config({ 'unique-slugs': true }),
      'A.case.tsx': caseFile(
        `defineCases('A', { 'Sign in': () => null, 'Sign-in': () => null }, { level: 'atom' })`,
      ),
    })
    expect(only(await run(dir), 'unique-slugs')).toHaveLength(1)
  })

  // ── tweak-defaults-valid ──────────────────────────────────────────────────

  test('tweak-defaults: flags a choice default outside its options', async () => {
    const dir = await setup({
      'display-case.config.ts': config({ 'tweak-defaults-valid': true }),
      'A.case.tsx': caseFile(
        `defineCases('A', { Default: { tweaks: { size: tweak.choice(['sm','lg'], 'sm') }, render: () => null } }, { level: 'atom' })`,
      ).replace(`'sm') }`, `'xl' as 'sm') }`),
    })
    expect(only(await run(dir), 'tweak-defaults-valid')).toHaveLength(1)
  })

  test('tweak-defaults: passes for a valid choice default', async () => {
    const dir = await setup({
      'display-case.config.ts': config({ 'tweak-defaults-valid': true }),
      'A.case.tsx': caseFile(
        `defineCases('A', { Default: { tweaks: { size: tweak.choice(['sm','lg'], 'lg') }, render: () => null } }, { level: 'atom' })`,
      ),
    })
    expect(only(await run(dir), 'tweak-defaults-valid')).toHaveLength(0)
  })

  // ── interactive-cases-keyed ───────────────────────────────────────────────

  // A case file with a stateful `Demo` wrapper defined above the export, then
  // `cases` rendered from a record of `Name: jsx` entries. `import 'react'` may
  // not resolve in the temp dir, but the rule reads source text (not the loaded
  // module), so a load failure is irrelevant here.
  const statefulCase = (cases: string, header = '') =>
    `${header}import { defineCases } from '${DC}'\n` +
    `import { useState } from 'react'\n` +
    `function Demo({ initial }: { initial: string }) {\n` +
    `  const [v, setV] = useState(initial)\n` +
    `  return <button type="button" onClick={() => setV('x')}>{v}</button>\n` +
    `}\n` +
    `export default defineCases('Seg', { ${cases} }, { level: 'atom' })\n`

  test('interactive-keyed: flags a stateful specimen reused across cases without keys', async () => {
    const dir = await setup({
      'display-case.config.ts': config({ 'interactive-cases-keyed': true }),
      'Seg.tsx': 'export const Seg = () => null\n',
      'Seg.case.tsx': statefulCase(
        `A: () => <Demo initial="a" />, B: () => <Demo initial="b" />`,
      ),
    })
    const f = only(await run(dir), 'interactive-cases-keyed')
    expect(f).toHaveLength(1)
    expect(f[0]!.message).toContain('<Demo>')
  })

  test('interactive-keyed: passes when every usage carries a key', async () => {
    const dir = await setup({
      'display-case.config.ts': config({ 'interactive-cases-keyed': true }),
      'Seg.tsx': 'export const Seg = () => null\n',
      'Seg.case.tsx': statefulCase(
        `A: () => <Demo key="a" initial="a" />, B: () => <Demo key="b" initial="b" />`,
      ),
    })
    expect(only(await run(dir), 'interactive-cases-keyed')).toHaveLength(0)
  })

  test('interactive-keyed: a single-use stateful specimen is safe (always remounts)', async () => {
    const dir = await setup({
      'display-case.config.ts': config({ 'interactive-cases-keyed': true }),
      'Seg.tsx': 'export const Seg = () => null\n',
      'Seg.case.tsx': statefulCase(
        `A: () => <Demo initial="a" />, B: () => <span>static</span>`,
      ),
    })
    expect(only(await run(dir), 'interactive-cases-keyed')).toHaveLength(0)
  })

  test('interactive-keyed: ignores a pure (stateless) component reused across cases', async () => {
    const dir = await setup({
      'display-case.config.ts': config({ 'interactive-cases-keyed': true }),
      'Seg.tsx': 'export const Seg = () => null\n',
      'Seg.case.tsx':
        `import { defineCases } from '${DC}'\n` +
        `function Pure({ label }: { label: string }) { return <span>{label}</span> }\n` +
        `export default defineCases('Seg', { A: () => <Pure label="a" />, B: () => <Pure label="b" /> }, { level: 'atom' })\n`,
    })
    expect(only(await run(dir), 'interactive-cases-keyed')).toHaveLength(0)
  })

  test('interactive-keyed: an allow marker waives the file', async () => {
    const dir = await setup({
      'display-case.config.ts': config({ 'interactive-cases-keyed': true }),
      'Seg.tsx': 'export const Seg = () => null\n',
      'Seg.case.tsx': statefulCase(
        `A: () => <Demo initial="a" />, B: () => <Demo initial="b" />`,
        '// display-case: allow-interactive-cases-keyed shared on purpose\n',
      ),
    })
    expect(only(await run(dir), 'interactive-cases-keyed')).toHaveLength(0)
  })

  // ── composition rules ──────────────────────────────────────────────────────

  test('atom-purity: flags an atom importing another component', async () => {
    const dir = await setup({
      'display-case.config.ts': config({ 'atom-purity': true }),
      'Button.tsx': `import { Icon } from './icon'\nexport const Button = () => Icon\n`,
      'Button.case.tsx': caseFile(
        `defineCases('Button', {}, { level: 'atom' })`,
      ),
      'icon.tsx': 'export const Icon = null\n',
      'icon.case.tsx': caseFile(`defineCases('Icon', {}, { level: 'atom' })`),
    })
    expect(only(await run(dir), 'atom-purity')).toHaveLength(1)
  })

  test('atom-purity: an unresolvable bare import is not a violation', async () => {
    const dir = await setup({
      'display-case.config.ts': config({ 'atom-purity': true }),
      'Button.tsx': `import { useState } from 'react'\nexport const Button = () => useState\n`,
      'Button.case.tsx': caseFile(
        `defineCases('Button', {}, { level: 'atom' })`,
      ),
    })
    expect(only(await run(dir), 'atom-purity')).toHaveLength(0)
  })

  test('atom-purity: a commented-out or string-literal import is not a dependency', async () => {
    const dir = await setup({
      'display-case.config.ts': config({ 'atom-purity': true }),
      // The scanner ignores these; the old regex would have treated them as a
      // real import of `Icon` and falsely flagged the atom.
      'Button.tsx':
        `// import { Icon } from './icon'\n` +
        `const sample = "import { Icon } from './icon'"\n` +
        `export const Button = () => sample\n`,
      'Button.case.tsx': caseFile(
        `defineCases('Button', {}, { level: 'atom' })`,
      ),
      'icon.tsx': 'export const Icon = null\n',
      'icon.case.tsx': caseFile(`defineCases('Icon', {}, { level: 'atom' })`),
    })
    expect(only(await run(dir), 'atom-purity')).toHaveLength(0)
  })

  test('no-downward-dependency: flags a molecule importing an organism', async () => {
    const dir = await setup({
      'display-case.config.ts': config({ 'no-downward-dependency': true }),
      'Mol.tsx': `import { Org } from './org'\nexport const Mol = () => Org\n`,
      'Mol.case.tsx': caseFile(`defineCases('Mol', {}, { level: 'molecule' })`),
      'org.case.tsx': caseFile(`defineCases('Org', {}, { level: 'organism' })`),
    })
    expect(only(await run(dir), 'no-downward-dependency')).toHaveLength(1)
  })

  test('no-downward-dependency: same-level import is allowed', async () => {
    const dir = await setup({
      'display-case.config.ts': config({ 'no-downward-dependency': true }),
      'Org1.tsx': `import { Org2 } from './org2'\nexport const Org1 = () => Org2\n`,
      'Org1.case.tsx': caseFile(
        `defineCases('Org1', {}, { level: 'organism' })`,
      ),
      'org2.case.tsx': caseFile(
        `defineCases('Org2', {}, { level: 'organism' })`,
      ),
    })
    expect(only(await run(dir), 'no-downward-dependency')).toHaveLength(0)
  })

  test('composes-lower-level: an organism of only atoms passes', async () => {
    const dir = await setup({
      'display-case.config.ts': config({ 'composes-lower-level': true }),
      'Org.tsx': `import { A } from './a'\nexport const Org = () => A\n`,
      'Org.case.tsx': caseFile(`defineCases('Org', {}, { level: 'organism' })`),
      'a.case.tsx': caseFile(`defineCases('A', {}, { level: 'atom' })`),
    })
    expect(only(await run(dir), 'composes-lower-level')).toHaveLength(0)
  })

  test('composes-lower-level: flags a molecule composing nothing lower', async () => {
    const dir = await setup({
      'display-case.config.ts': config({ 'composes-lower-level': true }),
      'Mol.tsx': `import { useState } from 'react'\nexport const Mol = () => useState\n`,
      'Mol.case.tsx': caseFile(`defineCases('Mol', {}, { level: 'molecule' })`),
    })
    expect(only(await run(dir), 'composes-lower-level')).toHaveLength(1)
  })

  test('composition: a generic allow-<rule-id> marker exempts the file', async () => {
    const dir = await setup({
      'display-case.config.ts': config({ 'no-downward-dependency': true }),
      // The marker waives this rule for this component only.
      'Mol.tsx': `// display-case: allow-no-downward-dependency intentional\nimport { Org } from './org'\nexport const Mol = () => Org\n`,
      'Mol.case.tsx': caseFile(`defineCases('Mol', {}, { level: 'molecule' })`),
      'org.case.tsx': caseFile(`defineCases('Org', {}, { level: 'organism' })`),
    })
    expect(only(await run(dir), 'no-downward-dependency')).toHaveLength(0)
  })

  // ── level-fit (advisory) ─────────────────────────────────────────────────

  test('level-fit: flags a component over its level threshold', async () => {
    const rules = ALL_RULES.map((id) =>
      id === 'level-fit'
        ? `'level-fit': { thresholds: { molecule: 1 } }`
        : `'${id}': false`,
    ).join(', ')
    const dir = await setup({
      'display-case.config.ts': `export default { title:'F', roots:['**/*.case.tsx'], check:{ structure:{ rules:{ ${rules} } } } }\n`,
      // A molecule composing two atoms exceeds the threshold of 1.
      'Mol.tsx': `import { A } from './a'\nimport { B } from './b'\nexport const Mol = () => [A, B]\n`,
      'Mol.case.tsx': caseFile(`defineCases('Mol', {}, { level: 'molecule' })`),
      'a.case.tsx': caseFile(`defineCases('A', {}, { level: 'atom' })`),
      'b.case.tsx': caseFile(`defineCases('B', {}, { level: 'atom' })`),
    })
    const f = only(await run(dir), 'level-fit')
    expect(f).toHaveLength(1)
    expect(f[0]!.severity).toBe('warn')
    expect(f[0]!.message).toContain('promoting')
  })

  test('level-fit: off by default', async () => {
    const dir = await setup({
      // No check config ⇒ defaults apply; level-fit is opt-in (off).
      'display-case.config.ts': `export default { title:'F', roots:['**/*.case.tsx'] }\n`,
      'Mol.tsx': `import { A } from './a'\nimport { B } from './b'\nexport const Mol = () => [A, B]\n`,
      'Mol.case.tsx': caseFile(`defineCases('Mol', {}, { level: 'molecule' })`),
      'a.case.tsx': caseFile(`defineCases('A', {}, { level: 'atom' })`),
      'b.case.tsx': caseFile(`defineCases('B', {}, { level: 'atom' })`),
    })
    expect(only(await run(dir), 'level-fit')).toHaveLength(0)
  })

  // ── severity ───────────────────────────────────────────────────────────────

  test('severity: composes-lower-level defaults to warn', async () => {
    const dir = await setup({
      'display-case.config.ts': config({ 'composes-lower-level': true }),
      'Mol.tsx': `export const Mol = () => null\n`,
      'Mol.case.tsx': caseFile(`defineCases('Mol', {}, { level: 'molecule' })`),
    })
    const f = only(await run(dir), 'composes-lower-level')
    expect(f).toHaveLength(1)
    expect(f[0]!.severity).toBe('warn')
  })

  test('severity: a per-rule override flips warn to error', async () => {
    const dir = await setup({
      'display-case.config.ts': config({ 'composes-lower-level': 'error' }),
      'Mol.tsx': `export const Mol = () => null\n`,
      'Mol.case.tsx': caseFile(`defineCases('Mol', {}, { level: 'molecule' })`),
    })
    expect(only(await run(dir), 'composes-lower-level')[0]!.severity).toBe(
      'error',
    )
  })

  test('severity: strict mode escalates warnings to errors', async () => {
    const dir = await setup({
      'display-case.config.ts': config({ 'composes-lower-level': true }),
      'Mol.tsx': `export const Mol = () => null\n`,
      'Mol.case.tsx': caseFile(`defineCases('Mol', {}, { level: 'molecule' })`),
    })
    const f = only(await run(dir, { strict: true }), 'composes-lower-level')
    expect(f[0]!.severity).toBe('error')
  })

  test('a disabled rule contributes no findings', async () => {
    const dir = await setup({
      // Every rule disabled.
      'display-case.config.ts': config({}),
      'Widget.tsx': 'export const Widget = () => null\n',
    })
    expect(await run(dir)).toHaveLength(0)
  })

  test('nav-groups-resolve warns on a group no surface resolves to', async () => {
    const dir = await setup({
      'display-case.config.ts': config(
        { 'nav-groups-resolve': true },
        ", nav: { groups: { order: ['Marketing', 'Nope'] } }",
      ),
      // A page under marketing/ resolves to the 'Marketing' group; 'Nope' has no
      // surface, so only it is reported — at warning severity.
      'marketing/Pricing.case.tsx': caseFile(
        "defineCases('Pricing', { Default: () => null }, { level: 'page' })",
      ),
    })
    const f = only(await run(dir), 'nav-groups-resolve')
    expect(f).toHaveLength(1)
    expect(f[0]!.message).toContain('Nope')
    expect(f[0]!.severity).toBe('warn')
  })

  test('nav-groups-resolve stays silent when every group ref resolves', async () => {
    const dir = await setup({
      'display-case.config.ts': config(
        { 'nav-groups-resolve': true },
        ", nav: { groups: { order: ['Marketing'] } }",
      ),
      'marketing/Pricing.case.tsx': caseFile(
        "defineCases('Pricing', { Default: () => null }, { level: 'page' })",
      ),
    })
    expect(only(await run(dir), 'nav-groups-resolve')).toHaveLength(0)
  })

  test('nav-groups-resolve also checks labels and collapsed refs', async () => {
    const dir = await setup({
      'display-case.config.ts': config(
        { 'nav-groups-resolve': true },
        ", nav: { groups: { labels: { Ghost: 'X' }, collapsed: ['Phantom'] } }",
      ),
      'marketing/Pricing.case.tsx': caseFile(
        "defineCases('Pricing', { Default: () => null }, { level: 'page' })",
      ),
    })
    const msgs = only(await run(dir), 'nav-groups-resolve').map(
      (x) => x.message,
    )
    expect(msgs).toHaveLength(2)
    expect(msgs.join(' ')).toContain('Ghost')
    expect(msgs.join(' ')).toContain('Phantom')
  })
})
