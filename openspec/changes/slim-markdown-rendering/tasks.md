## 1. Swap the placard renderer

- [ ] 1.1 Add `markdown-to-jsx` to `dependencies` in `package.json` and run `bun install`
- [ ] 1.2 Rewrite `DocMarkdown` in `src/ui/markdown.tsx` to render with `markdown-to-jsx`, passing `options={{ disableParsingRawHTML: true }}` and keeping the `<div className="dc-doc-md">` wrapper; use `overrides` only if a tag needs structural wrapping
- [ ] 1.3 Update the file's doc comment to describe the new renderer while restating the no-raw-HTML and no-syntax-highlighting stances

## 2. Lock down behavior with tests

- [ ] 2.1 Extend `src/ui/markdown.test.tsx` to assert the placard subset renders: H1/H2, bold/italic, inline code, fenced code (plain `<pre><code>`), unordered lists, links, GFM tables, and GFM strikethrough
- [ ] 2.2 Keep/strengthen the assertion that raw HTML (`<b>`) is not rendered as a live element and `<script>` is not injected — pinning the `placard-docs` no-raw-HTML requirement
- [ ] 2.3 Confirm the tests pass under `renderToStaticMarkup` (SSR path), since the doc panel is server-rendered

## 3. Drop the old dependency

- [ ] 3.1 Remove `react-markdown` from `package.json`; keep `remark-gfm` and `@mdx-js/mdx` (still used by the Primer)
- [ ] 3.2 Run `bun install` and verify the lockfile drops `react-markdown` and the rehype/hast packages unique to it; note in the PR that the shared micromark/mdast core remains via `@mdx-js/mdx`

## 4. Verify the gate and the surface

- [ ] 4.1 Run `bun run lint`, `bun run typecheck`, `bun run check`, and `bun test` — all green
- [ ] 4.2 Run the showcase (`bun run display-case`), open a component's doc panel, and visually compare placard rendering (headings, tables, code, lists, links, strikethrough) against the pre-change output in both light and dark themes
- [ ] 4.3 Confirm the Primer still renders (its `@mdx-js/mdx` path is untouched)

## 5. Close out

- [ ] 5.1 Post-change review: update `contributing/coding-best-practices.md`, `contributing/NOTES.md`, and `docs/` only where the markdown-rendering swap actually affects them (e.g. the no-raw-HTML guarantee, the renderer choice rationale); skip files genuinely unaffected
- [ ] 5.2 Validate the change with `openspec validate slim-markdown-rendering --strict` and run `/openspec:archive slim-markdown-rendering`
