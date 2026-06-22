## 1. The mdx-lite compiler (done as a spike)

- [x] 1.1 Add `src/core/mdx-lite/` with `segmentMdx` + `mdxToTsx` (dependency-free, no repo imports)
- [x] 1.2 Aggressive test suite: scanner edge cases, segmentation matrix, emitted-TSX validity, synthetic + real-`primer.mdx` SSR round-trips

## 2. Add the renderer dependency

- [x] 2.1 `bun add markdown-to-jsx`

## 3. Swap the placard renderer (prerequisite to dropping the old deps)

- [x] 3.1 Rewrite `src/ui/markdown.tsx` to render with `markdown-to-jsx` (`disableParsingRawHTML: true`)
- [x] 3.2 Update `src/ui/markdown.test.tsx`: placard subset (headings, bold, inline code, fenced code, lists, links, GFM tables, strikethrough) + no-raw-HTML guard

## 4. Wire the Primer to mdx-lite

- [x] 4.1 Rewrite `src/core/mdx-plugin.ts` to compile via `mdxToTsx` (loader `tsx`)
- [x] 4.2 Update `src/core/mdx-plugin.test.ts` to assert tsx output + `MDXContent` default export
- [x] 4.3 Repoint `src/checks/structure-check.ts` `primer-present-and-used` at `segmentMdx`
- [x] 4.4 Confirm `src/checks/structure-check.test.ts` covers the new code path (existing primer cases pass unchanged — no edit needed)

## 5. Drop the legacy deps

- [x] 5.1 `bun remove @mdx-js/mdx remark-gfm react-markdown`; verify nothing else imports them

## 6. Verify and document

- [x] 6.1 Run the gate: `bun run lint`, `bun run typecheck`, `bun run check`, `bun test`
- [x] 6.2 Render the Primer and a placard (light + dark) and confirm content parity
- [ ] 6.3 Document the supported Primer dialect in `docs/` and note it in `contributing/NOTES.md`
- [ ] 6.4 Validate `openspec validate bun-native-primer --strict` (done) and archive both changes (pending)
