## Context

The Primer is the only remaining `@mdx-js/mdx` consumer. `primer.mdx` uses:
leading ES `import`s of its specimen components, block-level JSX specimens
(`<Display …>` with JSX children and expression props like
`style={{ fontSize: '0.875rem' }}`), GFM prose, and a fenced ` ```mdx ` sample
that contains `<Display>` as literal text. The compiled module is invoked as
`MDXContent({ components })`: capitalized tags the document does not import
(only `<Display>`) resolve from `components`, and Markdown `#`/`##` route to
`components.h1`/`h2`.

Two earlier findings frame this: (1) `@mdx-js/mdx` runs at build time, so it is
not in the shipped browser bundle — dropping it shrinks the dependency graph, not
the bundle; (2) the unified ecosystem is shared between `@mdx-js/mdx`,
`remark-gfm`, and `react-markdown`, so all three must go together to prune it for
consumers. The `slim-markdown-rendering` change already establishes
`markdown-to-jsx` as the prose renderer.

## Goals / Non-Goals

**Goals:**
- Compile `primer.mdx` (and the documented dialect) without `@mdx-js/mdx`, using
  a dependency-free in-repo compiler plus Bun's own TSX toolchain.
- Remove `@mdx-js/mdx`, `remark-gfm`, and `react-markdown`; unify all markdown
  rendering on `markdown-to-jsx`.
- Keep the `MDXContent({ components })` contract so codegen, SSR-primer, and the
  primer mount are untouched.

**Non-Goals:**
- General MDX compatibility. Inline JSX in prose, `{expressions}` in prose, and
  Markdown nested inside JSX children are deliberately unsupported.
- Publishing the compiler as a standalone package now (kept extractable; see
  Decisions).
- Any browser-bundle size change (this path is build-time only).

## Decisions

### Decision 1: Segment, don't parse MDX

`mdx-lite` classifies a document into three block kinds and emits `.tsx`:
- **imports** → passed through verbatim; Bun's bundler resolves them like any TS.
- **block JSX** (a line beginning at column 0 with `<Capitalized…` or `<>`,
  consumed to its matching close) → passed through verbatim; Bun's TSX compiler
  handles JSX and expression props for free — the exact features a runtime
  Markdown renderer cannot do, and the reason `markdown-to-jsx` alone could not
  replace MDX here.
- **markdown runs** → emitted as `<Markdown options={{disableParsingRawHTML:true,
  overrides}}>{<JSON-stringified text>}</Markdown>`. Embedding the payload via
  `JSON.stringify` eliminates an entire escaping bug class (backticks, `${`).

The hard part is the segmenter's JSX scanner: it tracks tag depth across lines
and ignores `<`/`>`/`{`/`}` inside attribute strings, expression braces, and JSX
comments. Fenced code is recognized first, so ` ```…``` ` content is always prose.

**Alternatives considered:** reusing an ecosystem MDX wrapper (`@next/mdx`,
`next-mdx-remote`, `mdx-bundler`) — all depend on `@mdx-js/mdx` and add weight;
`next-mdx-remote` cannot even do the Primer's `import`s. A runtime
`markdown-to-jsx` component map — cannot do ES imports or expression props.
A hand-rolled CommonMark parser — unnecessary; `markdown-to-jsx` handles prose.

### Decision 2: Resolve non-imported components from `components`

The emitter scans JSX blocks for capitalized tag names, subtracts the names bound
by the document's imports, and destructures the remainder from the `components`
prop (today just `Display`). Headings route to `components.h1`/`h2` via
`markdown-to-jsx` `overrides`. This preserves the exact `MDXContent({components})`
contract the mount and SSR path already rely on, so nothing downstream changes.

### Decision 3: Build internal, keep extractable

`mdx-lite` lives at `src/core/mdx-lite/` with **zero imports from the rest of the
repo** and a pure `mdxToTsx(source, opts) → string` API (the Markdown import
specifier is an option, used by tests to inject a stub). It can be lifted into
its own package later with no rewrite; we do not publish now (only local
consumers). No off-the-shelf parser fills this niche — every real MDX is
unified-based, and tiny markdown parsers lack JSX/import support.

### Decision 4: `structure-check` shares the segmenter

The `primer-present-and-used` rule switches from the `@mdx-js/mdx` AST walk to
`segmentMdx`: count specimens whose root/declared tag is `Display`, and confirm
at least one prose (markdown) block exists. Same guarantees, no MDX dependency,
and unsupported input surfaces as a parse error from the same code path the build
uses.

## Risks / Trade-offs

- **Segmenter correctness on edge cases** → covered by 27 tests (string/brace/
  comment scanning, nested/fragment/spread/expression JSX, multi-line imports and
  JSX, fenced-code-with-`<Tag>`, autolinks, CRLF, degenerate inputs) plus a full
  SSR round-trip of the real `primer.mdx` (20 `Display` specimens).
- **Silent mis-render of unsupported input** → mitigated: the dialect is
  documented, and `structure-check` runs the same compile path, so malformed
  primers fail the gate loudly rather than rendering wrong.
- **Repo `node_modules` doesn't shrink** → expected; the `openspec` devDep keeps
  a unified subtree. Frame the win as the consumer dependency graph (128 → 6).

## Migration Plan

1. Add `markdown-to-jsx`; swap `src/ui/markdown.tsx` (placard) to it.
2. Wire `src/core/mdx-plugin.ts` to `mdxToTsx` (loader `tsx`).
3. Repoint `structure-check.ts` to `segmentMdx`; update its test.
4. Remove `@mdx-js/mdx`, `remark-gfm`, `react-markdown`; `bun install`.
5. Run the gate (lint, typecheck, `display-case check`, unit, e2e) and render the
   Primer + a placard to confirm parity.
6. **Rollback**: restore the three deps and revert the four modules — the
   `mdx-lite` directory can remain dormant.

## Open Questions

- None blocking. Future: extract `mdx-lite` to its own package if a second
  consumer appears.
