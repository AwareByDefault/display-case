## Why

Rendering a component's `.placard.md` doc panel currently pulls in
`react-markdown` + `remark-gfm` — and through them the entire `unified` /
`remark` / `rehype` / `micromark` / `mdast` / `hast` subtree (~58 transitive
packages). This stack is **always on the chrome's load path** (the doc panel is
statically imported), yet the placards only use a small CommonMark + GFM subset:
headings, bold/italic, inline code, fenced code (no highlighting), lists, links,
GFM tables, and strikethrough. We are paying a heavyweight, plugin-oriented
document-processing pipeline for what is plain prose rendering. A single
zero-runtime-dependency renderer (`markdown-to-jsx`) covers the full placard
feature set and roughly **halves the shipped chrome bundle's markdown cost**
(measured: ~60 KB → ~26 KB gzipped; see Impact), shrinking the always-loaded
bundle of Display Case — itself a deliberately "dependency-light" tool.

## What Changes

- Replace `react-markdown` + `remark-gfm` in the placard doc panel
  (`src/ui/markdown.tsx`) with `markdown-to-jsx`, configured with
  `disableParsingRawHTML: true` to preserve today's behavior that author-supplied
  raw HTML / `<script>` is never injected into the chrome, and `overrides` only
  where the chrome needs to style or wrap an element.
- Drop `react-markdown` as a dependency, shedding the rehype/hast subtree only it
  pulls in. `remark-gfm` and `@mdx-js/mdx` remain for the Primer path.
- **Codify** the placard panel's existing safety guarantee — author-supplied raw
  HTML and scripts are not rendered or executed — as an explicit `placard-docs`
  requirement, since the new renderer parses raw HTML by default and the guard is
  now a deliberate configuration choice rather than an inherited library default.
- **Out of scope (investigated, intentionally not changed): the Primer's MDX
  path.** The Primer (`.mdx`) is compiled by `@mdx-js/mdx` and genuinely needs
  MDX-grade features that `markdown-to-jsx` cannot provide: real ES `import`
  statements (the Primer imports its own specimen components) and JSX expression
  props such as `style={{ fontSize: '0.875rem' }}`. `@mdx-js/mdx` is already
  **lazy and opt-in** — dynamically imported, and a consumer with no Primer pays
  nothing for it — so its cost is contained. Design records why it stays and
  defers any Primer-renderer change to a separate, harder decision.
- **Rejected: a hand-rolled CommonMark renderer.** Recorded in design as a
  non-goal — `markdown-to-jsx` already delivers a battle-tested CommonMark + GFM
  parser at ~6 KB, and matching its correctness on CommonMark's edge cases
  (nested lists, link reference definitions, escaping, emphasis precedence) is a
  maintenance tarpit with no offsetting payoff.

## Capabilities

### New Capabilities
<!-- none — this change introduces no new observable capability -->

### Modified Capabilities
- `placard-docs`: Add an explicit requirement that the documentation panel
  renders authored docs as formatted text **without injecting or executing
  author-supplied raw HTML or scripts**. This codifies behavior today enforced
  only by a unit test, making it a guarantee the rendering-library swap must
  preserve. No change to which markdown features render.

## Impact

- **Code**: `src/ui/markdown.tsx` (the `DocMarkdown` renderer) and its colocated
  test `src/ui/markdown.test.tsx`. The Primer is untouched
  (`src/core/mdx-plugin.ts`, `src/ui/primer.tsx`, `src/checks/structure-check.ts`).
- **Dependencies & size (measured, bun 1.3.14)**: the headline win is the
  **shipped browser chrome bundle**, where the markdown path drops from
  **~202 KB → ~72 KB minified (~60 KB → ~26 KB gzipped, ≈57% smaller)**. On disk,
  by contrast, `node_modules` slightly *grows*: removing `react-markdown` prunes
  only **one** package (~80 KB) because its entire transitive closure is shared
  with the retained `@mdx-js/mdx` + `remark-gfm`, while `markdown-to-jsx` unpacks
  to ~4.3 MB (mostly source maps and unused per-framework/CJS dist variants the
  bundler never ships). Net node_modules: ≈ +4 MB; net shipped bundle: ≈ −34 KB
  gzipped. The repo's own source/tracked size is essentially unchanged.
- **Behavior**: placard rendering is observably unchanged (same CommonMark + GFM
  subset, same no-raw-HTML stance). The Primer is unchanged.
- **Risk**: low. `markdown-to-jsx` must reproduce the placard feature set and the
  no-raw-HTML guard; both are covered by the existing colocated test, extended
  rather than rewritten.
