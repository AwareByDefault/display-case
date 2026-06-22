## Why

The Primer is the last consumer of `@mdx-js/mdx`, which (with `remark-gfm`) is the
root of Display Case's entire `unified` / `remark` / `rehype` / `micromark` /
`mdast` markdown subtree. The Primer only needs a narrow slice of MDX: prose
interleaved with **block-level** component specimens, plus ordinary ES `import`s.
A purpose-built, dependency-free compiler that segments that constrained dialect
into `.tsx` — handing imports and JSX-expression props back to Bun's own
TypeScript compiler, and rendering prose with the same `markdown-to-jsx` the doc
placards use — lets us delete `@mdx-js/mdx`, `remark-gfm`, and `react-markdown`
together. Measured, this collapses the **consumer production dependency graph
from 128 packages / 13 MB to 6 packages / 5.4 MB**. (Because `@mdx-js/mdx` runs
at build time, the shipped browser bundle is unaffected by this change — the win
is the dependency surface, fully realizing the project's dependency-light goal.)

The only consumers today are local and author nothing exotic, so there is no
migration burden: the compiler must reproduce exactly the constructs Display
Case's own `primer.mdx` uses, and that supported dialect is documented and
enforced.

## What Changes

- Add `src/core/mdx-lite/` — a self-contained, dependency-free compiler exposing
  `segmentMdx(source)` and `mdxToTsx(source, opts)`. It segments a document into
  imports / markdown / block-JSX, emits a `.tsx` module whose default export is
  `MDXContent({ components })`, and defers imports + JSX expressions to Bun's TSX
  compiler and prose to `markdown-to-jsx`. (Already prototyped with 27 tests,
  including a real-`primer.mdx` SSR round-trip.)
- Rewrite `src/core/mdx-plugin.ts` to compile `.mdx` via `mdxToTsx` (loader
  `tsx`) instead of `@mdx-js/mdx`.
- Repoint `src/checks/structure-check.ts`'s `primer-present-and-used` rule at
  `segmentMdx` (count `Display` specimens, confirm prose) instead of the
  `@mdx-js/mdx` AST.
- Swap the placard renderer (`src/ui/markdown.tsx`) to `markdown-to-jsx` — the
  prerequisite from the `slim-markdown-rendering` change — so that all three
  legacy markdown deps can be removed in one coherent step.
- **Remove** `@mdx-js/mdx`, `remark-gfm`, and `react-markdown`; add
  `markdown-to-jsx`. **BREAKING** for any consumer whose primer uses MDX features
  outside the documented dialect (inline JSX in prose, `{expressions}` in prose,
  Markdown nested inside JSX children) — none exist today.
- Document the supported Primer authoring dialect in the product docs.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `primer`: Add an explicit requirement that fenced code samples in a primer's
  prose render as formatted code and are never executed as live specimens —
  pinning the edge case the new compiler must (and does) honor.

## Impact

- **Code**: `src/core/mdx-lite/` (new), `src/core/mdx-plugin.ts`,
  `src/checks/structure-check.ts`, `src/ui/markdown.tsx`, and the colocated tests
  for each (`mdx-plugin.test.ts`, `structure-check.test.ts`, `markdown.test.tsx`).
  No change to the codegen, SSR-primer, or primer mount — the compiled module
  keeps the same `MDXContent({ components })` shape.
- **Dependencies**: removes `@mdx-js/mdx`, `remark-gfm`, `react-markdown`; adds
  `markdown-to-jsx`. Consumer production install drops from 128 packages / 13 MB
  to 6 packages / 5.4 MB. The repo's own `node_modules` is roughly flat (the
  `openspec` devDep keeps a unified subtree for its own use).
- **Behavior**: the Primer and placards render the same content; the Primer's
  accepted authoring dialect narrows to the documented, enforced subset.
- **Risk**: concentrated in the segmenter; mitigated by an aggressive test suite
  (scanner edge cases + the real `primer.mdx` round-trip) and by `structure-check`
  failing loudly on unsupported input rather than mis-rendering.
