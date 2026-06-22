import type { BunPlugin } from 'bun'
import { mdxToTsx } from './mdx-lite'

/**
 * Absolute path to `markdown-to-jsx`, resolved from Display Case's own location
 * (this module), memoized on first use.
 *
 * The compiled primer module is loaded from inside the *consumer* package's tree
 * (its `primer.mdx` is the bundle entry), so a bare `import 'markdown-to-jsx'`
 * would be resolved relative to the consumer — and `markdown-to-jsx` is a private
 * dependency of `@awarebydefault/display-case`, not hoisted into the consumer's
 * scope, so that resolution fails with `Could not resolve "markdown-to-jsx"`.
 * Emitting an absolute path anchored at Display Case's own install makes the
 * import resolve regardless of the consumer's `node_modules` layout, so authoring
 * a Markdown/MDX primer never requires the consumer to redeclare the dep. It also
 * resolves to the same physical module the `.placard.md` DocPanel imports, so Bun
 * dedupes the two into one bundled copy.
 */
let cachedMarkdownSpecifier: string | undefined
function markdownSpecifier(): string {
  if (cachedMarkdownSpecifier === undefined) {
    try {
      cachedMarkdownSpecifier = Bun.resolveSync(
        'markdown-to-jsx',
        import.meta.dir,
      )
    } catch {
      // Fall back to the bare specifier (matches mdx-lite's own default) for the
      // case where a consumer does carry the dep and resolution from here fails.
      cachedMarkdownSpecifier = 'markdown-to-jsx'
    }
  }
  return cachedMarkdownSpecifier
}

/**
 * Bun bundler plugin that compiles `.mdx` to TSX on load, so the Primer entry can
 * `import` an authored `.mdx` document and the components it pulls in.
 *
 * Compilation is done by the in-repo `mdx-lite` compiler (no `@mdx-js/mdx`): it
 * segments the document into imports / prose / block-level JSX and emits a `.tsx`
 * module. The author's `import`s and JSX expression props pass through verbatim
 * and are handled by Bun's own TSX toolchain; prose renders via `markdown-to-jsx`
 * (the same renderer the `.placard.md` DocPanel uses, so the two reading surfaces
 * stay consistent). The compiled default export is `MDXContent({ components })`:
 * capitalized JSX a doc doesn't import (notably `<Display>`) resolves from the
 * `components` prop passed at render time (see `primer-mount`).
 *
 * The `tsx` loader hands the emitted source back to Bun, which strips types and
 * compiles JSX with the project's automatic React runtime.
 */
export function mdxPlugin(): BunPlugin {
  return {
    name: 'display-case-mdx',
    setup(build) {
      build.onLoad({ filter: /\.mdx$/ }, async (args) => {
        const source = await Bun.file(args.path).text()
        return {
          contents: mdxToTsx(source, {
            markdownSpecifier: markdownSpecifier(),
          }),
          loader: 'tsx',
        }
      })
    },
  }
}
