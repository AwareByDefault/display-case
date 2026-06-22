import { describe, expect, test } from 'bun:test'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { makeTempDir } from '../testing/test-helpers'
import { mdxPlugin } from './mdx-plugin'

type OnLoadArgs = { path: string }
type OnLoadResult = { contents: string; loader: string }
type OnLoadCb = (args: OnLoadArgs) => Promise<OnLoadResult>

/**
 * Drive the plugin without a real Bun build: capture the `onLoad` handler it
 * registers, then invoke it against a temp `.mdx` file and inspect the compiled
 * output.
 */
function captureOnLoad(): {
  filter: RegExp
  run: OnLoadCb
} {
  const calls: Array<{ filter: RegExp; cb: OnLoadCb }> = []
  const build = {
    onLoad: (opts: { filter: RegExp }, cb: OnLoadCb) =>
      calls.push({ filter: opts.filter, cb }),
  }
  const plugin = mdxPlugin()
  plugin.setup(build as unknown as Parameters<typeof plugin.setup>[0])
  if (!calls[0]) throw new Error('plugin registered no onLoad handler')
  return { filter: calls[0].filter, run: calls[0].cb }
}

describe('mdxPlugin', () => {
  test('registers an onLoad handler that matches .mdx files only', () => {
    const { filter } = captureOnLoad()
    expect(filter.test('doc.mdx')).toBe(true)
    expect(filter.test('doc.tsx')).toBe(false)
  })

  test('compiles an .mdx document to a TSX module on load', async () => {
    const { run } = captureOnLoad()
    const dir = await makeTempDir()
    try {
      const file = join(dir, 'doc.mdx')
      await Bun.write(
        file,
        "import { Button } from './c'\n\n# Title\n\nSome **bold** text.\n\n<Display><Button/></Display>\n",
      )
      const result = await run({ path: file })
      // mdx-lite emits TSX so Bun handles imports + JSX expression props.
      expect(result.loader).toBe('tsx')
      expect(result.contents).toContain('export default function MDXContent')
      // Author imports pass through; <Display> resolves from the components prop.
      expect(result.contents).toContain("import { Button } from './c'")
      expect(result.contents).toContain('const { Display } = __components')
      // Emitted TSX is syntactically valid.
      new Bun.Transpiler({ loader: 'tsx' }).transformSync(result.contents)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
