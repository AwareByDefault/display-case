import { afterAll, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  buildRegistry,
  labelFor,
  pageNameFor,
  repoSlug,
  rewriteLinks,
} from './generate'

const registry = new Map<string, string>([
  ['docs/cli.md', 'CLI'],
  ['docs/testing.md', 'Testing'],
  ['docs/ai-agents.md', 'AI-Agents'],
  ['contributing/testing-best-practices.md', 'Testing-Best-Practices'],
])

// Pretend tree: these repo-relative paths exist; `tools/lint` and `openspec` are dirs.
const present = new Set([
  'docs/examples/plain.case.tsx',
  'src/checks/providers/playwright-driver.ts',
  'tools/lint',
  'openspec/specs',
])
const opts = {
  registry,
  slug: 'AwareByDefault/display-case',
  exists: (p: string) => present.has(p),
  isDirectory: (p: string) => p === 'tools/lint' || p === 'openspec/specs',
}

const rewrite = (md: string, src: string) => rewriteLinks(md, src, opts)

describe('repoSlug', () => {
  test('parses an https git url', () => {
    expect(
      repoSlug('git+https://github.com/AwareByDefault/display-case.git'),
    ).toBe('AwareByDefault/display-case')
  })
  test('parses an ssh url', () => {
    expect(repoSlug('git@github.com:owner/repo.git')).toBe('owner/repo')
  })
})

describe('pageNameFor / labelFor', () => {
  test('title-cases a hyphenated basename', () => {
    expect(pageNameFor('docs/writing-placard-docs.md')).toBe(
      'Writing-Placard-Docs',
    )
  })
  test('applies acronym overrides', () => {
    expect(pageNameFor('docs/cli.md')).toBe('CLI')
    expect(pageNameFor('docs/ai-agents.md')).toBe('AI-Agents')
  })
  test('disambiguates the two README files', () => {
    expect(pageNameFor('docs/examples/README.md')).toBe('Examples')
    expect(pageNameFor('contributing/README.md')).toBe('Contributing')
  })
  test('labelFor humanizes a page name', () => {
    expect(labelFor('Writing-Cases')).toBe('Writing Cases')
  })
})

describe('buildRegistry', () => {
  const dirs: string[] = []
  afterAll(async () => {
    await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })))
  })
  const tree = async (files: Record<string, string>) => {
    const root = await mkdtemp(join(tmpdir(), 'wiki-reg-'))
    dirs.push(root)
    // Bun.write creates parent directories as needed.
    for (const [rel, body] of Object.entries(files)) {
      await Bun.write(join(root, rel), body)
    }
    return root
  }

  test('throws when two docs derive the same wiki page name', async () => {
    // docs/foo.md and contributing/foo.md both -> "Foo".
    const root = await tree({
      'docs/foo.md': '# a',
      'contributing/foo.md': '# b',
    })
    await expect(buildRegistry(root)).rejects.toThrow(/page name collision/i)
  })

  test('does not flag the two README files (PAGE_OVERRIDES disambiguates)', async () => {
    const root = await tree({
      'docs/examples/README.md': '# ex',
      'contributing/README.md': '# c',
    })
    const reg = await buildRegistry(root)
    expect(reg.get('docs/examples/README.md')).toBe('Examples')
    expect(reg.get('contributing/README.md')).toBe('Contributing')
  })
})

describe('rewriteLinks', () => {
  test('intra-doc link becomes a wiki page link', () => {
    expect(rewrite('see [the CLI](cli.md)', 'docs/configuration.md')).toBe(
      'see [the CLI](CLI)',
    )
  })

  test('preserves anchors on page links', () => {
    expect(rewrite('[x](testing.md#structure-checks)', 'docs/cli.md')).toBe(
      '[x](Testing#structure-checks)',
    )
  })

  test('cross-tree link resolves through ../', () => {
    expect(
      rewrite(
        '[x](../docs/testing.md)',
        'contributing/linting-best-practices.md',
      ),
    ).toBe('[x](Testing)')
  })

  test('same-page anchor and external links are untouched', () => {
    const md =
      '[a](#providers) and [b](https://example.com) and [c](mailto:x@y.z)'
    expect(rewrite(md, 'docs/cli.md')).toBe(md)
  })

  test('link to a code file becomes a blob URL', () => {
    expect(
      rewrite(
        '[d](../src/checks/providers/playwright-driver.ts)',
        'docs/testing.md',
      ),
    ).toBe(
      '[d](https://github.com/AwareByDefault/display-case/blob/main/src/checks/providers/playwright-driver.ts)',
    )
  })

  test('link to a directory becomes a tree URL', () => {
    expect(
      rewrite('[t](../tools/lint/)', 'contributing/linting-best-practices.md'),
    ).toBe(
      '[t](https://github.com/AwareByDefault/display-case/tree/main/tools/lint)',
    )
  })

  test('root-relative authored path that misses file-relative falls back to repo root', () => {
    // `openspec/specs` from a contributing/ file resolves file-relative to
    // contributing/openspec/specs (missing) -> falls back to root openspec/specs (a dir).
    expect(rewrite('[s](openspec/specs)', 'contributing/README.md')).toBe(
      '[s](https://github.com/AwareByDefault/display-case/tree/main/openspec/specs)',
    )
  })

  test('image link becomes a raw URL', () => {
    expect(rewrite('![logo](../assets/logo.png)', 'docs/cli.md')).toBe(
      '![logo](https://raw.githubusercontent.com/AwareByDefault/display-case/main/assets/logo.png)',
    )
  })
})
