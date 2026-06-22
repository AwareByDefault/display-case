import type { BunPlugin } from 'bun'
import { mdxToTsx } from './mdx-lite'

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
        return { contents: mdxToTsx(source), loader: 'tsx' }
      })
    },
  }
}
