import type { BunPlugin } from 'bun'

/**
 * Bun bundler plugin that compiles `.mdx` to JavaScript on load, so the Primer
 * entry can `import` an authored `.mdx` document and the components it pulls in.
 *
 * The compile uses MDX's automatic React runtime (`react/jsx-runtime`) and no
 * provider import source — capitalized JSX a doc doesn't import (notably
 * `<Display>`) is resolved from the `components` prop passed to the compiled
 * `MDXContent` at render time (see `primer-mount`). `@mdx-js/mdx` is a normal
 * dependency, but the import is dynamic so a consumer that never configures a
 * Primer pays nothing for it.
 *
 * GFM (`remark-gfm`) is enabled so a Primer authors Markdown tables,
 * strikethrough, task lists, and autolinks — the same flavour the `.placard.md`
 * DocPanel already renders (see `ui/markdown.tsx`), so the two reading surfaces
 * stay consistent. It's the same already-bundled dependency; the dynamic import
 * keeps it off the path of a consumer with no Primer.
 */
export function mdxPlugin(): BunPlugin {
  return {
    name: 'display-case-mdx',
    setup(build) {
      build.onLoad({ filter: /\.mdx$/ }, async (args) => {
        const [{ compile }, { default: remarkGfm }] = await Promise.all([
          import('@mdx-js/mdx'),
          import('remark-gfm'),
        ])
        const source = await Bun.file(args.path).text()
        const compiled = await compile(source, {
          jsxImportSource: 'react',
          development: false,
          remarkPlugins: [remarkGfm],
        })
        return { contents: String(compiled), loader: 'js' }
      })
    },
  }
}
