## Context

Display Case renders two kinds of authored markdown, through two separate
pipelines:

1. **Placard docs** (`*.placard.md`) — per-component usage prose shown in the
   doc panel. Rendered by `src/ui/markdown.tsx`'s `DocMarkdown`, which statically
   imports `react-markdown` + `remark-gfm`. Because the import is static, this
   stack is on the **always-loaded** chrome path. The placards are pure
   CommonMark + GFM — a survey of the 72 `*.placard.md` files in the repo shows
   only: H1/H2 headings, bold/italic, inline code, fenced code blocks (rendered
   plain — syntax highlighting is a deliberate non-goal), unordered lists, links,
   GFM tables, GFM strikethrough, and HTML comments. No frontmatter, blockquotes,
   images, footnotes, task lists, or embedded JSX.

2. **Primer** (`*.mdx`) — a collection-level long-form page that interleaves
   prose with **live** component specimens. Compiled by `@mdx-js/mdx` via a Bun
   bundler plugin (`src/core/mdx-plugin.ts`), parsed again for structure checks
   (`src/checks/structure-check.ts`), and mounted with a component map
   (`src/ui/primer.tsx`). The import is **dynamic** — a consumer with no Primer
   never loads `@mdx-js/mdx`.

Both pipelines together pull in ~58 transitive packages (the
`unified`/`remark`/`rehype`/`micromark`/`mdast`/`hast` ecosystem, plus Babel via
`@mdx-js/mdx`). The heaviest single contributor is `@mdx-js/mdx` (~368 KB), but
it is lazy. `react-markdown` (~80 KB) is the heaviest **always-on** contributor.

Constraint: Display Case is explicitly a dependency-light tool, and render must
stay pure/deterministic (SSR before scripts). The doc panel is server-rendered,
so any replacement must render correctly under `renderToStaticMarkup`.

## Goals / Non-Goals

**Goals:**

- Remove `react-markdown` (and the rehype/hast packages only it pulls in) from
  the always-loaded chrome bundle.
- Render the placard CommonMark + GFM subset with a ~6 KB, zero-runtime-dependency
  library, with no observable change to what placards render.
- Preserve the existing safety stance: author-supplied raw HTML / scripts are
  never injected into or executed in the chrome — and make that an explicit spec
  requirement, not just a test.

**Non-Goals:**

- Changing the Primer / MDX pipeline. It stays on `@mdx-js/mdx` (see Decisions).
- Adding syntax highlighting to fenced code (remains a deliberate non-goal).
- Adding any placard feature not already used (frontmatter, images, task lists…).
- Hand-rolling a CommonMark parser (rejected — see Decisions).

## Decisions

### Decision 1: Use `markdown-to-jsx` for the placard path

Replace `react-markdown` + `remark-gfm` in `DocMarkdown` with `markdown-to-jsx`.

- **What it gives us**: no runtime dependencies beyond the React peer (it bundles
  a fork of `simple-markdown` as its parser); full GFM support (tables,
  strikethrough, autolinks, task lists); renders to React elements (no
  `dangerouslySetInnerHTML`); SSR-safe.
- **Measured size (bun 1.3.14, tree-shaken, `--minify --target=browser`,
  React externalized)**: the shipped markdown cost in the chrome bundle drops
  from `react-markdown` + `remark-gfm` at **~202 KB min / ~60 KB gzip** to
  `markdown-to-jsx` at **~72 KB min / ~26 KB gzip** — roughly a 57% reduction
  (~34 KB gzip). Note this is well above the often-quoted "~6 KB": v9 bundles a
  generated HTML-entities table (~35 KB raw) for entity decoding, which dominates
  its size and does not tree-shake away. It is still less than half the old path.
- **Security parity**: `markdown-to-jsx` parses raw HTML **by default**, which
  would be a regression against today's behavior. We set
  `disableParsingRawHTML: true` so raw HTML in a doc is not turned into live
  elements — matching `react-markdown`'s default and the existing
  `markdown.test.tsx` expectations. This is the single behavioral knob that must
  not be omitted; the spec delta and an extended test pin it.
- **Styling**: the wrapper stays `<div className="dc-doc-md">`; element-level
  styling continues via CSS on that scope. `overrides` are used only if a tag
  needs structural wrapping — preferred approach is to keep using plain tag
  output and CSS so the swap is as close to a drop-in as possible.

**Alternatives considered:**

- **`marked` / `markdown-it` → HTML string + `dangerouslySetInnerHTML`**:
  smaller/comparable parsers, but they emit HTML strings, forcing
  `dangerouslySetInnerHTML` (an XSS surface and an SSR-purity wart) and losing
  React-element output. Rejected.
- **`micromark` + `micromark-extension-gfm` directly**: the smallest compliant
  CommonMark+GFM parser, but emits HTML strings (same `dangerouslySetInnerHTML`
  problem) and is lower-level — we'd be rebuilding the React-element mapping that
  `markdown-to-jsx` already provides. Rejected.
- **Keep `react-markdown`, just trim plugins**: doesn't address the core weight;
  `react-markdown` itself plus the `unified`/`hast` machinery is the always-on
  cost. Rejected.

### Decision 2: Keep `@mdx-js/mdx` for the Primer — do not migrate it now

The Primer genuinely requires MDX-grade capabilities that `markdown-to-jsx`
cannot provide, confirmed by reading `src/ui/design-system/primer.mdx`:

- **Real ES `import` statements** at the top of the document
  (`import { Button, … } from './components'`) — the codegen
  (`codegenPrimerEntry` / `codegenSsrPrimerEntry` in `src/core/discovery.ts`)
  treats the compiled `.mdx` as a real ES module and lets Bun's bundler resolve
  and bundle those component imports. `markdown-to-jsx` has no module system; it
  resolves embedded tags only from a runtime `overrides`/component map.
- **JSX expression props** such as `style={{ fontSize: '0.875rem' }}` and
  `theme="dark"` on `<Display>`. `markdown-to-jsx` only parses JSON-ish prop
  values and deliberately stringifies arbitrary JS expressions for safety; a
  `style={{…}}` object literal is not valid JSON and would not survive.

Replacing MDX here would mean redesigning the Primer authoring model (a component
registry instead of imports, constrained props) and rewriting the
structure-check's AST walk — a behavior change to the `primer` capability, not a
slimming. Because `@mdx-js/mdx` is already dynamically imported and opt-in (no
Primer ⇒ no cost), its weight is contained. We keep it and leave any Primer
renderer change to a separate, explicitly-scoped proposal. `remark-gfm` stays for
this path.

**Ecosystem MDX wrappers considered and rejected** (registry-confirmed — each
declares `@mdx-js/mdx` directly or transitively, so all *add* weight on top of
the core we already call):

- **`@next/mdx`**: a Next.js webpack/turbopack loader config (peerDeps
  `@mdx-js/loader` → `@mdx-js/mdx`, `@mdx-js/react`). Requires Next's build
  system; Display Case has no webpack/Next and bundles with `Bun.build`.
  Non-starter.
- **`next-mdx-remote`**: a runtime/remote MDX-string compiler (~107 KB unpacked
  on top of `@mdx-js/mdx` ^3 + `@mdx-js/react` + Babel). Renders from a string
  with components passed via scope and **does not support `import` statements in
  the MDX source** — which is exactly how the Primer pulls in its specimens.
  Breaks the authoring model.
- **`mdx-bundler`**: bundles MDX *and its imports* via **esbuild** (deps
  `@mdx-js/esbuild` → `@mdx-js/mdx`, peer `esbuild` — a ~10 MB+ native
  toolchain). It supports imports, but only by adding a second bundler to do what
  `Bun.build` already does. Redundant for a Bun-native tool.

The current direct `compile()`-in-a-Bun-plugin integration is already what
`mdx-bundler` does minus the bundled esbuild — i.e. the leanest available
integration. None of these three is a slimmer drop-in.

### Decision 3: Do not hand-roll a CommonMark renderer

The placard feature set is small, which tempts a bespoke renderer — but
CommonMark's correctness lives in its edge cases (nested/loose lists, link
reference definitions, backslash escaping, emphasis precedence, tight vs. loose
paragraphs). `markdown-to-jsx` already implements these at ~6 KB with no runtime
deps. A repo-local or sibling-repo parser would start smaller but accrete bug
fixes toward the same size with worse coverage. Reserved strictly as a last
resort if `markdown-to-jsx` proves unworkable; it is not.

## Risks / Trade-offs

- **Raw-HTML regression if `disableParsingRawHTML` is omitted** → the spec delta
  makes the no-raw-HTML behavior a requirement, and `markdown.test.tsx` keeps an
  assertion that `<script>`/`<b>` source is not rendered. Both fail loudly if the
  option is dropped.
- **Subtle rendering differences vs. `react-markdown`** (e.g. exact wrapping of
  table cells, tight-list `<p>` handling) → extend `markdown.test.tsx` to assert
  the placard subset (headings, bold, inline code, fenced code, lists, links,
  tables, strikethrough) and eyeball the running doc panel against current
  output before archiving.
- **node_modules grows on disk; the win is the bundle, not the install** →
  measured: removing `react-markdown` prunes only **one** package (~80 KB)
  because its whole transitive closure is shared with the retained
  `@mdx-js/mdx` + `remark-gfm`, while `markdown-to-jsx` unpacks to ~4.3 MB
  (mostly source maps and unused per-framework/CJS dist variants the bundler
  never ships), so `node_modules` nets ≈ +4 MB. The payoff is entirely in the
  **shipped chrome bundle** (~34 KB gzip smaller) — not disk footprint. Frame the
  post-change notes around bundle size, and don't claim a node_modules
  reduction.
- **`markdown-to-jsx` maintenance/ownership** (the npm package has changed hands)
  → it is widely used, ~6 KB, and the placard surface is small; if it ever
  stalls, Decision 3's hand-roll remains the documented fallback.

## Migration Plan

1. Add `markdown-to-jsx`; rewrite `DocMarkdown` to use it with
   `disableParsingRawHTML: true`.
2. Extend `src/ui/markdown.test.tsx` to cover the placard feature subset plus the
   no-raw-HTML guard; keep it green.
3. Remove `react-markdown` from `package.json`; run `bun install` and confirm the
   lockfile drops `react-markdown` and its unique rehype/hast deps.
4. Run the gate (`bun run lint`, `bun run typecheck`, `bun run check`,
   `bun test`) and visually compare the doc panel.
5. **Rollback**: revert `DocMarkdown` and restore the `react-markdown` dependency
   — the change is confined to one module, one test, and `package.json`.

## Open Questions

- None blocking. A future, separately-scoped question: is a registry-based,
  `markdown-to-jsx`-powered Primer worth the authoring-model change to also shed
  `@mdx-js/mdx`? Deferred out of this change.
