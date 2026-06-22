## 1. Swap the placard renderer

- [x] 1.1 Add `markdown-to-jsx` to `dependencies` in `package.json` and run `bun install`
- [x] 1.2 Rewrite `DocMarkdown` in `src/ui/markdown.tsx` to render with `markdown-to-jsx`, passing `options={{ disableParsingRawHTML: true }}` and keeping the `<div className="dc-doc-md">` wrapper; use `overrides` only if a tag needs structural wrapping
- [x] 1.3 Update the file's doc comment to describe the new renderer while restating the no-raw-HTML and no-syntax-highlighting stances

## 2. Lock down behavior with tests

- [x] 2.1 Extend `src/ui/markdown.test.tsx` to assert the placard subset renders: H1/H2, bold/italic, inline code, fenced code (plain `<pre><code>`), unordered lists, links, GFM tables, and GFM strikethrough
- [x] 2.2 Keep/strengthen the assertion that raw HTML (`<b>`) is not rendered as a live element and `<script>` is not injected — pinning the `placard-docs` no-raw-HTML requirement
- [x] 2.3 Confirm the tests pass under `renderToStaticMarkup` (SSR path), since the doc panel is server-rendered

## 3. Drop the old dependency

- [x] 3.1 Remove `react-markdown` from `package.json` (done together with `remark-gfm` + `@mdx-js/mdx` via the `bun-native-primer` work)
- [x] 3.2 Run `bun install` and verify the lockfile drops `react-markdown`; note that because `@mdx-js/mdx` was also removed, the full micromark/mdast subtree leaves the consumer install (128 → 6 packages)

## 4. Verify the gate and the surface

- [x] 4.1 Run `bun run lint`, `bun run typecheck`, `bun run check`, and `bun test` — all green
- [x] 4.2 Run the showcase (`bun run display-case`), open a component's doc panel, and confirm placard rendering (headings, tables, code, lists, links, strikethrough) in both light and dark themes
- [x] 4.3 Confirm the Primer still renders (now via the in-repo `mdx-lite` compiler)

## 5. Close out

- [x] 5.1 Post-change review: updated `contributing/coding-best-practices.md` (§6.2 deps), `contributing/NOTES.md` (new dated entry), and `docs/documentation-panel.md` (renderer name) for the markdown-rendering swap; `docs/writing-placard-docs.md` needed no change (behaviour-described, not library-named)
- [ ] 5.2 Validate the change with `openspec validate slim-markdown-rendering --strict` (done) and run `/openspec:archive slim-markdown-rendering` (pending)
