import { afterEach, describe, expect, test } from 'bun:test'
import { rm } from 'node:fs/promises'
import { makeTempDir, writeFiles } from './test-helpers'
import { checkTokens } from './tokens-check'

// A minimal config whose only token source of truth is `tokens.css`. `extra`
// splices additional config fields (e.g. a tokens allowlist) into the literal.
const config = (extra = '') =>
  `export default { title: 'Fixture', roots: ['**/*.case.tsx'], globalStyles: ['tokens.css']${extra} }\n`

describe('checkTokens', () => {
  const dirs: string[] = []
  const setup = async (files: Record<string, string>) => {
    const dir = await makeTempDir()
    dirs.push(dir)
    await writeFiles(dir, files)
    return dir
  }

  afterEach(async () => {
    while (dirs.length)
      await rm(dirs.pop() as string, { recursive: true, force: true })
  })

  test('passes when every reference resolves to a defined token', async () => {
    const dir = await setup({
      'display-case.config.ts': config(),
      'tokens.css': ':root { --color-bg: #fff; }',
      'button.css': '.b { background: var(--color-bg); }',
    })
    const { violations, definedCount } = await checkTokens(dir)
    expect(violations).toEqual([])
    expect(definedCount).toBeGreaterThanOrEqual(1)
  })

  test('flags a reference to an undefined token', async () => {
    const dir = await setup({
      'display-case.config.ts': config(),
      'tokens.css': ':root { --color-bg: #fff; }',
      'button.css': '.b { color: var(--mystery); }', // allow: unknown-token
    })
    const { violations } = await checkTokens(dir)
    expect(violations).toHaveLength(1)
    expect(violations[0].token).toBe('--mystery')
    expect(violations[0].hadFallback).toBe(false)
    expect(violations[0].file.endsWith('button.css')).toBe(true)
  })

  test('reports the 1-based line and column of the token', async () => {
    const dir = await setup({
      'display-case.config.ts': config(),
      'tokens.css': ':root{--a:1;}',
      'x.css': 'a{color:1;}\nb{fill:var(--missing);}', // allow: unknown-token
    })
    const { violations } = await checkTokens(dir)
    expect(violations).toHaveLength(1)
    expect(violations[0].line).toBe(2)
    // `b{fill:` is 7 chars, `var(` opens at col 8, `--missing` begins at col 12.
    expect(violations[0].column).toBe(12)
  })

  test('a fallback value does not excuse an undefined token', async () => {
    const dir = await setup({
      'display-case.config.ts': config(),
      'tokens.css': ':root{}',
      'x.css': '.a{color:var(--ghost, #6b7280);}', // allow: unknown-token
    })
    const { violations } = await checkTokens(dir)
    expect(violations).toHaveLength(1)
    expect(violations[0].token).toBe('--ghost')
    expect(violations[0].hadFallback).toBe(true)
  })

  test('an allow-listed token name is treated as defined', async () => {
    const dir = await setup({
      'display-case.config.ts': config(`, tokens: { allow: ['--host-bg'] }`),
      'tokens.css': ':root{}',
      'x.css': '.a{background:var(--host-bg);}', // allow: unknown-token
    })
    const { violations, definedCount } = await checkTokens(dir)
    expect(violations).toEqual([])
    expect(definedCount).toBeGreaterThanOrEqual(1)
  })

  test('an `allow: unknown-token` comment suppresses on the same or preceding line', async () => {
    const dir = await setup({
      'display-case.config.ts': config(),
      'tokens.css': ':root{}',
      'same.css': '.a{color:var(--x);} /* allow: unknown-token */',
      'above.css': '/* allow: unknown-token */\n.a{color:var(--y);}',
    })
    const { violations } = await checkTokens(dir)
    expect(violations).toEqual([])
  })

  test('a var() inside a CSS comment is not treated as a reference', async () => {
    const dir = await setup({
      'display-case.config.ts': config(),
      'tokens.css': ':root{}',
      'x.css': '/* var(--commented) */\n.a{color:red;}', // allow: unknown-token
    })
    const { violations } = await checkTokens(dir)
    expect(violations).toEqual([])
  })

  test('a var() inside a JS string literal is a real reference', async () => {
    const dir = await setup({
      'display-case.config.ts': config(),
      'tokens.css': ':root{}',
      'x.tsx': `export const s = { color: 'var(--js-token)' }\n`, // allow: unknown-token
    })
    const { violations } = await checkTokens(dir)
    expect(violations.map((v) => v.token)).toContain('--js-token')
  })

  test('an inline-style object key defines a token for the whole package', async () => {
    const dir = await setup({
      'display-case.config.ts': config(),
      'tokens.css': ':root{}',
      'comp.tsx': `export const x = { style: { '--ring': 'red' } }\n`,
      'comp.css': '.a{outline-color:var(--ring);}',
    })
    const { violations } = await checkTokens(dir)
    expect(violations).toEqual([])
  })

  test('resolves a reference whose definition lives in a different file', async () => {
    const dir = await setup({
      'display-case.config.ts': config(),
      'tokens.css': ':root{ --shared: 2px; }',
      'a.css': '.a{ gap: var(--shared); }', // allow: unknown-token
    })
    const { violations } = await checkTokens(dir)
    expect(violations).toEqual([])
  })

  test('sorts violations by file, then line, then column', async () => {
    const dir = await setup({
      'display-case.config.ts': config(),
      'tokens.css': ':root{}',
      'b.css': '.a{color:var(--p);}', // allow: unknown-token
      'a.css': '.a{color:var(--q);}\n.b{color:var(--r);}', // allow: unknown-token
    })
    const { violations } = await checkTokens(dir)
    expect(violations.map((v) => v.token)).toEqual(['--q', '--r', '--p'])
  })

  test('reports the number of scanned files', async () => {
    const dir = await setup({
      'display-case.config.ts': config(),
      'tokens.css': ':root{--a:1;}',
      'x.css': '.a{color:var(--a);}', // allow: unknown-token
    })
    const { scannedFiles } = await checkTokens(dir)
    // config.ts + tokens.css + x.css (tokens.css is reached via both the glob
    // and globalStyles, but the path set dedups it).
    expect(scannedFiles).toBe(3)
  })
})
