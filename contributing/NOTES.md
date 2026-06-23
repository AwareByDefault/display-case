# Engineering Notes

Non-obvious decisions, debugging notes, and architectural context for the Display Case repo. Newest first. (Extracted from the project's original monorepo notes.)

---

## 2026-06-23: The dev watcher follows the module graph, not just the target's `src`

The dev server (`--dev`, and any interactive run) watches `<pkgDir>/src` (plus
Display Case's own UI under `--dev`). That misses **workspace siblings resolved
to source**: a package whose `exports`/`main` points at `./src/index.ts` with no
build step is a first-class bundle input, but it lives outside `<pkgDir>/src`, so
editing it never triggered a rebuild — the served bundle silently went stale
until an unrelated edit inside the target forced a re-bundle. (Reported against
the design-system loop: edit a shared component, view it through a consuming
app's cases, see nothing change.)

Fix: watch the bundler's **actual inputs**, not a fixed directory.
`src/core/graph-recorder.ts`:

- `graphRecorder(into)` is a Bun plugin with a catch-all `onLoad` that records
  `args.path` into a set and returns `undefined` (pure observation — the load
  falls through to the default loader or another plugin). It's registered
  **first** in every `Bun.build` plugin list in `rebuild` so paths the MDX plugin
  ultimately handles still get recorded. The union across the render/SSR/primer
  passes is the real module graph.
- `graphWatchDirs(inputs, {srcDir, hereDir, repoRoot})` maps each in-repo input
  outside `srcDir`/`hereDir` to its owning package, collapsed to that package's
  `src` when present, and the server reconciles a `@parcel/watcher` subscription
  per dir after every rebuild (graph can shift as imports change).

Two traps that cost real debugging time:

1. **`REPO_ROOT` is the wrong bound.** `REPO_ROOT` in `server.ts` is found by
   walking up from where **Display Case itself** lives to a `.git` — that's
   Display Case's repo (or `process.cwd()` when installed as a dep), *not* the
   target's monorepo. Bounding the watch by it drops every sibling in the
   target's repo. `findWatchRoot(pkgDir)` derives the **target's** workspace root
   (nearest `.git`, else topmost ancestor with a `package.json`); pass that as
   `repoRoot`.
2. **Bun records the symlink's real path.** A Bun-workspace sibling is symlinked
   into `node_modules/<name> -> ../../packages/<name>`, but `onLoad` reports the
   resolved **real** path (`packages/<name>/src/...`), not the `node_modules`
   one. So the `node_modules` exclusion in `graphWatchDirs` does **not** swallow
   workspace deps (good), and genuinely-installed deps (real `node_modules`
   files, pnpm store) stay excluded (also good).

## 2026-06-22: `check` a11y/visual report as `bun test` — per-variant pass/fail, timing, concurrency

The a11y and visual phases of `display-case check` used to print only failures
(`a11y ✗ …`, `visual ✗ …`), silently and serially. They now report like
`bun test`: every variant is a "test" with a `(pass)`/`(fail)`/`(record)` tag, its
own elapsed time, and a rolled-up summary (per-phase counts, overall `N pass`/`N
fail`, and a `Ran N checks [wall-clock] (concurrency K)` line). The formatting
lives in **`src/checks/check-reporter.ts`** — kept pure/side-effect-free so it's
unit-tested (`check-reporter.test.ts`), the same split as `a11yDetailLines`.
`check.ts` owns the timing, the browser, and the `console` writes.

Three things worth knowing for future edits:

- **Timing is `Bun.nanoseconds()`, per phase-per-variant.** Each a11y audit and
  each visual diff is timed independently (not the page-open). The summary's
  `Ran …` time is the **wall-clock** of the whole render run, which is *less* than
  the sum of per-variant times because variants run concurrently — that gap is
  expected, not a bug.

- **Variants scan concurrently via a small `mapPool` (default 4).** The built-in
  Playwright driver opens one page per variant from a shared `BrowserContext`, so
  concurrent pages overlap the browser-bound work cleanly. JS stays
  single-threaded, so the shared counters/tallies/`a11yReport` the workers mutate
  need **no locking** — only one worker runs between any two awaits. Configurable
  via `--concurrency=N` / `check.concurrency`; a custom `providers.driver` that
  can't handle concurrent `open()` must set concurrency to `1`.

- **Each variant's lines are buffered and flushed as one `console.log`.** Under
  concurrency, printing incrementally would interleave one variant's a11y/visual
  lines with another's mid-test. So a variant collects its lines into an array and
  emits them atomically when done — blocks stay contiguous, but **block order is
  completion order, not target order** (like `bun test` across files). Don't assume
  deterministic ordering when grepping; grep the `(pass)`/`(fail)` tags (plain
  text, no colour/glyphs) and the summary, which *are* deterministic.

---

## 2026-06-22: The compiled primer must self-resolve `markdown-to-jsx`

**Symptom (found dogfooding in a consumer repo).** A consumer authoring a
`primer.mdx`/`primer.md` got `Could not resolve "markdown-to-jsx"` at build time.
Cause: the compiled primer module is loaded from inside the **consumer's** tree
(its primer file *is* the bundle entry the `mdxPlugin` transforms in place), so
the emitted `import __Md from 'markdown-to-jsx'` was a **bare** specifier that Bun
resolved relative to the consumer. `markdown-to-jsx` is a private `dependency` of
`@awarebydefault/display-case`, not hoisted into the consumer's scope, so it
wasn't resolvable there. As a vendored workspace package it happened to work
(deps hoisted to the repo root); as a published external dep it broke.

**Fix.** `mdx-plugin.ts` now resolves `markdown-to-jsx` with
`Bun.resolveSync('markdown-to-jsx', import.meta.dir)` (anchored at Display Case's
own install) and passes the **absolute path** as `mdxToTsx`'s `markdownSpecifier`.
The import then resolves regardless of the consumer's `node_modules` layout, so a
consumer never needs to redeclare the dep. It resolves to the same physical
module `ui/markdown.tsx` imports for placards, so Bun dedupes to one copy. The
old per-package "declare `markdown-to-jsx` as a devDependency" workaround is no
longer needed. `mdx-lite` itself stays portable: its default is still the bare
`'markdown-to-jsx'`; the Display-Case-specific resolution lives in the plugin.
Guarded by `mdx-plugin.test.ts` (asserts the emitted specifier is absolute, never
bare) plus the unchanged build paths in `server.ts`.

---

## 2026-06-22: Browser bundles must pin React to the consumer (`pinReact`) — duplicate-React bug

**Symptom.** Hook-using components don't render on the Stage; the browser console
shows `Invalid hook call … more than one copy of React`, then
`Cannot read properties of null (reading 'useEffect')`. Hook-*free* components
(a presentational Badge) render fine and mask the bug.

**Root cause.** Display Case's own client runtime (`ui/browser-entry.tsx`,
`ui/render-mount.tsx`) statically imports `react-dom/client` + `react`. Those
bare specifiers resolve relative to **where Display Case itself is installed**,
while the consumer's `*.case.tsx` files and their deps resolve relative to the
**consumer project**. When the two installs differ, the browser bundle ends up
with **two** React copies — `react-dom` drives one React's dispatcher, the
consumer's components read the other's (null) dispatcher → invalid hook call.
This is the default for `bunx @awarebydefault/display-case <dir>` from a directory
where the tool isn't installed: bunx installs the package — and its peer
react/react-dom — into a temp prefix, distinct from the consumer's React.

**Fix.** `src/core/pin-react.ts` — a Bun bundler plugin whose `onResolve`
force-resolves every `react`/`react-dom`(`/…`) specifier via
`Bun.resolveSync(spec, pkgDir)`, i.e. from the **consumer** project. Bun bundles
one module per resolved absolute path, so pinning every specifier to one path
collapses the two copies to one regardless of how the tool was invoked (bunx temp,
global, npx, pnpm strict layout). Applied to the **browser** builds in both
`server.ts` (dev) and `publish.ts`, and to the dev server's **in-process SSR**
builds (so `renderToString` and the consumer's components share one React there
too — the same hazard for the server render). Resolve from `pkgDir`, **not** the
package dir: the renderer must bind to the React the consumer's components import.

**Why `publish.ts`'s SSR build is deliberately left `external` (the one asymmetry).**
A published build deploys with its own `bun install`, so the prod process already
has a single React. `prod-server` renders the chrome with its own `ssr-shell`
(which needs `react-dom/server` at runtime regardless); leaving the bundled case
renderers `external` keeps them on that *same* one copy. Bundling React there
would instead put a *second* copy in the prod process for no benefit — the
dual-React hazard comes from a temp/global *tool* install, which a clean deploy
doesn't have. Don't "fix" this to match the others.

**Regression guard.** `src/core/pin-react.test.ts` proves the resolution mapping
(the dedup guarantee). A genuine two-install reproduction (a "tool" React + a
"consumer" React, an entry importing both) confirms the bundle pulls *both* without
the plugin and *only the consumer's* with it. Note: pure-markup cases never catch
this — any future end-to-end guard needs a hook-using fixture exercised over the
temp-install path (`npm pack` → throwaway project with its own React), since local
workspace dev always resolves one hoisted React and hides the bug.

---

## 2026-06-22: The markdown/MDX stack is gone — `markdown-to-jsx` + in-repo `mdx-lite`

**What changed.** Three runtime deps — `react-markdown`, `remark-gfm`,
`@mdx-js/mdx` — and the entire `unified`/`remark`/`rehype`/`micromark`/`mdast`
subtree they pulled in are removed. All Markdown now renders through
`markdown-to-jsx`; the `.mdx` Primer is compiled by an in-repo compiler,
`src/core/mdx-lite/`. Production `dependencies` are now just `markdown-to-jsx`
and `@parcel/watcher`. Measured: a **consumer** production install drops from
**128 packages / 13 MB to 6 packages / 5.4 MB**.

**Why the bundle barely moved but the dep graph collapsed.** `@mdx-js/mdx` runs
at **build time** (the `.mdx` loader compiles to a module; the compiler never
ships to the browser), so dropping it shrinks the *dependency graph*, not the
shipped chrome bundle. The always-on win is only the placard swap
(`react-markdown` → `markdown-to-jsx`): ~60 KB → ~26 KB gzipped of the chrome.
Also note the ~8 MB of `@babel/*` in `node_modules` is **Emotion's**
(`@emotion/*` devDep via `babel-plugin`), *not* MDX's — `@mdx-js/mdx` v3 is
acorn/estree-based and pulls no Babel. And the repo's own `node_modules` does
*not* shrink, because the `@fission-ai/openspec` devDep keeps a unified subtree
for its own use; the 128→6 figure is consumer-facing (production deps only).

**`markdown-to-jsx` gotchas.** (1) It parses **raw HTML by default** — we pass
`options={{ disableParsingRawHTML: true }}` in `ui/markdown.tsx` to keep the
long-standing "docs never inject markup" guarantee; the colocated test pins it.
(2) Its real cost is ~26 KB gzipped, **not** the advertised ~6 KB: v9 bundles a
~35 KB generated HTML-entities table that doesn't tree-shake. (3) On disk the
package is ~4.3 MB unpacked (mostly source maps + unused per-framework/CJS dist
variants the bundler never ships) — so removing `react-markdown` actually grew
`node_modules` slightly; the payoff is the graph, not disk.

**How `mdx-lite` works (and why it's not a real MDX parser).** It does **not**
parse the combined Markdown+JSX grammar. It *segments* a document into three
block kinds — `imports` / `markdown` / block-level `jsx` — and emits a `.tsx`
module (loader `tsx`), then hands the hard parts back to the toolchain that
already exists: author `import`s and JSX **expression props** (`style={{…}}`)
pass through verbatim to Bun's TSX compiler; prose runs render via
`markdown-to-jsx`. This is the whole reason `markdown-to-jsx` alone couldn't
replace the Primer (it has no ES imports and no expression props) but `mdx-lite`
can. Key implementation points:

- The emitted default export keeps the **exact existing contract**:
  `MDXContent({ components })`. Capitalized tags the document doesn't import
  (only `<Display>`) are destructured from `components`; Markdown headings route
  to `components.h1`/`h2` via `markdown-to-jsx` `overrides`. So the codegen,
  `ssr-primer`, and `primer-mount` are untouched.
- Markdown payloads are embedded as `<Markdown>{JSON.stringify(text)}</Markdown>`
  — `JSON.stringify` makes a valid JS string literal, killing the entire
  backtick / `${` / escape bug class that a template-literal embedding would hit.
- The **only** hard part is the segmenter's JSX scanner (`scanElement` /
  `scanBraces` / `scanString` in `mdx-lite/index.ts`): it tracks tag depth across
  lines and ignores `<`/`>`/`{`/`}` inside attribute strings, expression braces,
  and JSX comments. Fenced code is recognized first, so a ` ```mdx ` block
  containing `<Display>` stays prose. Aggressively tested in `mdx-lite.test.ts`.
- `mdx-lite` is **self-contained** (no imports from the rest of the repo) and
  shaped like a standalone package — `mdxToTsx(source, opts) → string`, with the
  Markdown import specifier as an option — so it can be extracted later if a
  second consumer appears. No off-the-shelf parser fits this niche: every real
  MDX is unified-based, and tiny Markdown parsers lack JSX/imports.
- `structure-check`'s `primer-present-and-used` rule now shares the **same**
  `segmentMdx` (counts `<Display>` tags + confirms a prose block) instead of the
  `@mdx-js/mdx` AST — so an unsupported/unparseable Primer fails the gate via the
  same code path the build uses, rather than mis-rendering.

The supported dialect (and what's intentionally rejected — inline JSX in prose,
Markdown inside JSX children, `{expr}` in prose) is documented for authors in
[configuration.md → Supported Primer syntax](../docs/configuration.md#supported-primer-syntax).
Relatedly,
the `interactive-cases-keyed`/JSX-AST note below still holds — Bun has no usable
JSX AST, so `mdx-lite` hand-rolls a scanner; but it only finds block extents, it
is not a general TSX AST.

## 2026-06-21: OpenSpec workspace lives at the repo root, and the CLI is pinned

The OpenSpec workspace is **`openspec/`** at the repo root — **not** under
`contributing/`, even though every other piece of engineering material is. This
is deliberate: the `openspec` CLI discovers its workspace by walking **up** from
the current directory looking for an `openspec/` dir. With the workspace under
`contributing/openspec/`, every command had to be run from `contributing/` and
`openspec list` from the repo root failed with the misleading
`No OpenSpec changes directory found. Run 'openspec init' first` — which does
*not* mean uninitialized, just "no `openspec/` found from here." Moving it to the
root makes the CLI (and the propose/apply/archive skills, which shell out to it)
work out of the box from anywhere in the tree.

The CLI is pinned as a devDependency: **`@fission-ai/openspec`** (exact
`1.4.1` — the bare `openspec` package on npm is unrelated). Pin reasons:
reproducibility, and the CLI's validator strictness is **version-specific**
(see below). Run it via `bun run openspec <cmd>` so the pinned
`node_modules/.bin` wins over any global install; `scripts/setup.ts` verifies it
resolves. Its `postinstall` is intentionally left untrusted/blocked (like
`@parcel/watcher`'s) — the binary works without it and trusting it would let it
scaffold files on install.

**Spec structure (`## Purpose` required):** the CLI's spec schema requires each
spec to have a `## Purpose` **and** a `## Requirements` section. The repo's
original house style was `# Title` + a prose intro + `## Requirements` (no
`## Purpose`), so for a while **every** spec failed `openspec validate --specs`
with `Spec must have a Purpose section`, and `openspec archive` (which rebuilds
and re-validates the target spec) aborted with it — the early workaround was
`openspec archive <change> --yes --skip-specs` plus hand-folding the requirement.

**Resolved (2026-06-21):** all 17 specs were conformed — the one-paragraph intro
is now wrapped in a `## Purpose` section (`# Title` → `## Purpose` →
`## Requirements`). `openspec validate --specs` now reports 17/17 passing, so
`archive` no longer needs `--skip-specs`. When authoring or editing a spec, keep
the `## Purpose` + `## Requirements` headers (see AGENTS.md → Spec rules). Note
the historical archived changes still describe the old `--skip-specs` flow.

---

## 2026-06-21: Style engines — render-time CSS-in-JS (emotion/MUI) delivered before scripting

`globalStyles` and the Vitrine stylesheet are *static* CSS, read from disk and
inlined into the document `<style>`. **Runtime CSS-in-JS** (emotion — hence
Material UI — styled-components, …) is different: it emits CSS *while a component
renders*, which `renderToString` discards. The `styleEngines` seam is the dynamic
counterpart that captures it. Things a future agent needs to know:

- **The seam is `src/render/collect-styles.ts` (`renderWithStyles`)**, called by
  both `ssr-render.tsx` and `ssr-primer.tsx`. It wraps the tree in each engine's
  provider, `renderToString`s, then concatenates each engine's `collect(html)`
  into a `headStyles` string. The case/primer result objects carry `headStyles?`;
  the dev (`server.ts`) and prod (`documents.ts`) document builders inject it.

- **Per-render factory, not a shared object.** `StyleEngine` is `() => StyleCollector`
  — invoked **once per render**. The SSR module is built once and reused across
  every request, so a shared emotion cache would collect case A's styling into
  case B's document. A fresh collector per render is what guarantees isolation.
  (`ssr-render.test.tsx` asserts distinct per-render instance ids.)

- **`headStyles` is a DISCRETE `<head>` tag, NOT folded into the base `<style>`.**
  This is load-bearing: emotion tags its output `<style data-emotion="css …">`,
  and the client runtime keys on `data-emotion` to *adopt* the server styles
  instead of re-injecting. Concatenating that CSS into our big `<style>` would
  strip the markers and bring back the flash + duplication. The builders place it
  as `</style>${headStyles}</head>` (after the static block, before `</head>`).

- **`styleEngines` (server) pairs with `decorator` (client + server).** The engine
  only does server-side extraction — it can't run on the client. The matching
  provider (MUI `ThemeProvider`, or a custom-key `CacheProvider`) goes in the
  `decorator`, which already wraps both the SSR and client trees. For emotion's
  *default* key (`css`) the client cache adopts automatically, so MUI needs no
  client engine code — that's why it's the clean flagship.

- **Inert when unused.** No engines ⇒ `headStyles` is `''` ⇒ documents are
  byte-identical to before (a `documents.test.ts` case asserts `doc({})` equals
  `doc({ headStyles: '' })`). `browserOnly` cases short-circuit before any engine
  runs and emit no `headStyles`.

- **No runtime dependency.** Display Case ships the `StyleEngine`/`StyleCollector`
  *types* only; the emotion/styled-components wiring is consumer code (a ~8-line
  recipe in `docs/style-engines.md`), kept out of the tool's deps on purpose.

---

## 2026-06-21: PR CI, change-scoped render checks, and committed visual baselines

**CI is a backstop to husky, not a replacement.** `.github/workflows/ci.yml` runs
the same gate the hooks run, on every PR, because hooks are bypassable and absent
for bot/web/merge-button edits. Jobs: `lint` (uses `bun run lint`, the *no-fix*
form — CI must fail on unformatted code, not silently fix it), `check`, `test`,
`e2e`, `a11y`, `visual`. They're separate jobs so each is its own PR check.

**Change-scoping (`--only` / `--changed`) only touches the render phases.** The
expensive a11y/visual phases can be restricted to affected components; structure/
tokens/ssr always run full (they're cheap). `src/core/affected.ts` builds each
component's import closure by walking **relative** specifiers only (JS + CSS
`@import`); bare specifiers (`react`, `display-case`) aren't traced — a PR never
edits node_modules. There is no Bun module-graph/metafile, hence the hand-rolled
walk.

**The soundness rule is the subtle part.** Component CSS here is concatenated and
inlined *globally* (`readVitrineCss` globs all `*.css`), and components don't
JS-import their own CSS — so a JS closure alone would miss CSS entirely. The fix:
a changed file that **no** component's closure claims (global CSS, the render
pipeline, shared `src/`, the barrel `components/index.ts`) scopes to **all**
components; a change with no render inputs at all (docs, tests, CI) scopes to
**none**. So a `.css` edit correctly fans out to all 35, a component `.tsx` edit
to just its dependents, and a docs edit to zero (no browser booted). Verified by
hand; see `affected.test.ts` for the attribution unit tests.

- **Gotcha — the barrel inflates closures.** The shell pages/templates import
  `components/index.ts`, which re-exports everything, so their closures include
  every component. A change to *any* component therefore always re-checks those ~6
  aggregator components. Sound (over-approximation), mildly less efficient.
- **Gotcha — uncommitted edits contaminate `--changed`.** It unions `git diff
  <ref>...HEAD` with `git diff HEAD`, so a dirty working tree (e.g. mid-feature)
  makes everything look changed → all affected. Commit first to test scoping.

**Visual baselines are committed and Linux-recorded.** `display-case.config.ts`
sets `baselineDir: ./test/visual-baselines` (208 PNGs). They MUST be recorded in
the same env CI renders in — `bun run baselines:record` does this via the pinned
`mcr.microsoft.com/playwright:v1.61.0-noble` Docker image (the `visual` CI job
runs in that same image). Recording on macOS would commit baselines CI can never
match (font/antialiasing). Keep the image tag, the record script, and the
`playwright` version in `bun.lock` in lockstep. The record script `apt-get
install`s unzip (bun's installer needs it; the image lacks it) and uses an
anonymous `node_modules` volume so the container's Linux install never clobbers
the host's.

- **Gotcha — committed baselines + a bare `check .` off-platform.** Because the
  baselines are Linux-recorded, running the visual phase on macOS reports dozens
  of false diffs (and writes `*.diff.png`, now gitignored). So the config opts
  `visual` out of the *default* phase set (`check.defaultPhases.visual = false`):
  a bare `display-case check .` skips it locally, but `--visual` and the CI job
  (which passes `--visual` in the matching container) still run it. The husky
  hooks never ran visual anyway (pre-commit is static + `bun test`; pre-push is
  e2e), so the local gate is unchanged.

---

## 2026-06-21: Component CSS is server-inlined (the Vitrine stylesheet), not runtime-injected

**What changed.** The design-system components used to paint by calling
`injectStyle(id, css)` at module load — a client-only `document.head` mutation
that **no-ops under Node**. So component CSS was absent from every
server-rendered document and only appeared once the browser bundle ran (a flash
of unstyled content; an unstyled `/render` snapshot if scripts were disabled).
Now each component keeps its CSS in a **co-located `.css` file** (`Button.tsx` →
`Button.css`) and **`readVitrineCss()`** (in `server.ts`, duplicated in
`publish.ts` like `readDesignTokens`) reads-and-concatenates, in **path-sorted**
order, `chrome.css` + every `components/**/*.css` + `primer.css` into one
**Vitrine stylesheet** inlined into every document `<style>` before scripts.
`inject-style.ts` and `src/types/css-text.d.ts` are deleted.

**Why read-and-concat, not a JS-side `import './x.css'`.** The project already
delivers its token CSS and `chrome.css` by reading files and concatenating
(`readDesignTokens`), never through the JS module graph. Bundling component CSS
through the browser/SSR entries would emit per-entry CSS assets and raise the
question of how a bare `.css` import behaves under `renderToString` (it's a
no-op under Bun's runtime — verified — but we avoid needing that). Reading the
files sidesteps all of it. New components are picked up automatically (the glob);
the dev watcher already matches `.css`, and the dev rebuild re-reads `vitrineCss`
next to its `tokensCss` re-read.

**Why it's inlined into the chrome-free `/render` too.** Display Case dogfoods
its own design system: the `dcui-*`/`dcpl-*`/shell `page` cases are exhibited
through `/render`, which carries no chrome. Inlining the whole Vitrine stylesheet
(including `chrome.css`, for the shell-page cases' `.dc-*` layout) into all three
documents keeps every such case styled before scripts. For a non-dogfooding
consumer that's a few KB of inert, fully-prefixed (`.dc-*`/`.dcui-*`/`.dcpl-*`)
chrome CSS in a **dev-time-only** preview doc — never shipped to their app.

**`/render` still needs `--dc-*` tokens.** The Vitrine CSS supplies *rules*, not
token values. `/render` resolves `--dc-*` from `globalCss`, which is why the
dogfood `display-case.config.ts` lists the token files in `globalStyles`.

**Lint footnote.** With the CSS now in real `.css` files, Biome's CSS linter sees
it: a few pre-existing intentional patterns (`!important` in specimen styles, one
descending-specificity selector in `A11yPanel.css`) surface as **warnings** —
non-fatal, and "fixing" them would change behavior, so they stand.

---

## 2026-06-21: A symlinked worktree `node_modules` corrupts the publish bundle (use `bun install`)

**The trap.** A fresh `git worktree` has no `node_modules` (gitignored). Setting it up by **symlinking** to the main checkout's modules (`ln -s ../../../node_modules node_modules`) — i.e. a link that resolves *outside* the worktree's own directory tree — passes `bun test` for plain `renderToStaticMarkup`/unit work but **breaks `publish.test.ts`** with a baffling cascade: `EBADF reading file: node_modules/react-dom/index.js`, then parse errors like `Expected ";" but found "type"` / `Unexpected interface` blamed on `react-dom`, `react-markdown`, and `remark-gfm`.

**Why it looks like remark-gfm but isn't.** The publish path runs **Bun's bundler** (`Bun.build`), not just the runtime resolver. Following a symlink that crosses the worktree boundary trips a file-descriptor bug in the bundler: it returns the *contents of a worktree source file* (`src/ui/use-shell.ts`, `test-ids.ts`) when asked to read a dependency path — so the error **path** (`react-dom/index.js`) and the error **content** (TS from our `src/`) don't match. The dependency names in the errors are red herrings; the unit tests pass because Bun's *runtime* module resolution tolerates the symlink while the *bundler* does not.

**Fix / rule.** Set up a worktree's modules with a real **`bun install`** (~0.5s from Bun's global cache, leaves git status clean), never an out-of-tree symlink. This is what [worktree-safe-execution.md](worktree-safe-execution.md) and the `lint-in-worktree` / `test-in-worktree` skills already prescribe — follow them rather than hand-rolling a symlink. Quick tell: if only the bundling tests (`publish`/`--ssr`) fail with `EBADF` or mismatched path-vs-content parse errors, suspect the `node_modules` setup, not the dependency.

---

## 2026-06-21: Import-graph rules use Bun's scanner; no native AST for keyed-cases

**What changed.** The composition (import-graph) structure rules previously parsed each component's imports with a regex (`IMPORT_RE`), which also matched **commented-out** and **string-literal** imports and counted (erased) **type-only** ones — any of which could conjure a phantom composition dependency and a false `atom-purity`/`no-downward-dependency` finding. `parseImports` now first asks **`Bun.Transpiler().scan(code)`** for the authoritative set of real runtime import paths (Bun's parser ignores comments/strings and drops type-only), then keeps only the regex matches whose source is in that set; the regex still contributes the **named bindings** scan doesn't expose. Bun-native, zero new dependency. Regression test: `atom-purity: a commented-out or string-literal import is not a dependency` (fails on the old regex, passes now).

**`scan()` gotchas.** It returns `{ kind, path }` per import — **no named specifiers** (so the regex is still needed for names) — and it **throws** on a few JSX shapes (notably `key` after a `{...spread}`). `parseImports` wraps it in try/catch and falls back to the regex alone when it throws.

**Why `interactive-cases-keyed` stays regex (Bun has no usable JSX AST).** Investigated whether Bun could replace that rule's hand-rolled JSX scan: it can't, cleanly. `Bun.Transpiler` exposes only `scan`/`scanImports` (imports/exports — no JSX tree) and `transform`/`transformSync`. `transformSync` *does* lower JSX so `key` becomes a positional arg (`jsxDEV(Type, props, key, …)`), but it (a) prints a stderr **warning** on `key`-after-spread and **falls back to the classic runtime** (where `key` is back inside props), so the signal isn't uniform, and (b) `scan` itself throws on that same shape. No runtime dependency parses TSX either (deps are MDX/markdown-oriented; `typescript` is dev-only and absent for consumers). So the only real AST route remains the deferred `ts.createSourceFile` path below, with its dependency trade-off — the regex stands.

---

## 2026-06-21: Display Case naming realignment — primer + placard, and a NUL-byte trap

**The two renames (museum metaphor, made consistent).** The whole-collection long-form reading surface was the "placard"; it is now the **primer** (an introductory text that primes a reader before the cases). The per-component usage-doc sibling was `<component>.prompt.md`; it is now `<component>.placard.md` (a *placard* is the label beside one exhibit — and `*.prompt.md` collided with the unrelated GitHub Copilot "prompt files" convention). Net mapping: each case → a **placard** (`*.placard.md`); the collection → a **primer** (`primer.mdx`, `/primer`, `/render/primer`). Rule ids moved too: `placard-present-and-used` → `primer-present-and-used`; `case-prompt-coverage` → `case-placard-coverage`; `no-orphaned-prompt-doc` → `no-orphaned-placard-doc`; marker `no-prompt` → `no-placard`; manifest field `promptDoc` → `placardDoc`; authoring skill `display-case-author-prompt-doc` → `display-case-author-placard-doc`. Full record: archived change `2026-06-21-display-case-rename-primer-and-placard`.

**Left untouched on purpose.** `.github/prompts/*.prompt.md` are real Copilot prompt files; the package's `display-case.prompt.md` is its AI-agent integration prompt. Neither is a component placard, so both keep `.prompt.md`. The spec never names the doc extension (it says "authored usage documentation"), so the `*.prompt.md → *.placard.md` rename was a docs/implementation change with **no spec delta** — only the placard→primer *surface* rename touched `openspec/specs/display-case/spec.md`.

**The NUL-byte trap (this will bite the next bulk rename).** `src/ui/shell-core.ts` built a composite specimen key with **raw NUL bytes** as delimiters: `` `${componentId}\0${caseId}\0…` `` written with literal U+0000 characters in the source. Raw NUL in a tracked file makes **git classify the source as binary**, which means `grep -I` (and `git grep`) **silently skip it** — so a `grep -rIl`-driven find/replace passes right over the file and leaves it stale. It was caught only because a renamed export then failed to resolve at test time. Fix applied: replace the raw bytes with the `\0` **string escape** — identical runtime value (the key still contains U+0000 separators) but plain-text source that text tooling sees. Lesson for bulk renames: detect binary-flagged tracked files first (`git grep -I` misses them; use `LC_ALL=C grep -a` or check for NUL with `tr -dc '\000'`), and prefer escapes over raw control bytes in source.

---

## 2026-06-21: Display Case `interactive-cases-keyed` check — regex now, AST deferred

**The foot-gun it guards.** The browse chrome swaps cases **in place** — `render-mount.tsx` re-renders one persistent React root with `root.render()` and never unmounts (so theme/tweak changes don't flicker). A controlled component in a case needs a little stateful wrapper (`function Demo({ initial }) { const [v, setV] = useState(initial); … }`) reused across several cases. Because that `<Demo>` sits at the same tree position across cases, React **keeps its `useState` value** instead of re-seeding from each case's `initial`. Between cases whose props differ (a different selected id, a disjoint option set) the leaked value shows the wrong selection — or none active at all (e.g. the value isn't in the new options, so no segment is `data-active`, and its label renders in the default muted colour). Fix: give each case's wrapper a **distinct `key`** so React remounts it. Single-use specimens are safe (a sibling case renders a different element, which remounts). Full authoring guidance: `docs/writing-cases.md` → Authoring rules.

**The check.** `interactive-cases-keyed` (structure rule, default on, error) in `src/checks/structure-check.ts`. It flags a locally-defined stateful wrapper (body calls `useState`/`useReducer`) rendered in **≥2** case thunks where any usage omits a `key`. It is **regex/text-based**, matching the rest of `structure-check` (zero parser deps): it blanks comments first via the shared `blankComments` in `src/checks/check-text.ts`, attributes each state hook to its nearest-preceding component definition, then counts `<Name …>` usages after `defineCases(` and checks each opening tag for `key=`. Escape hatch: `// display-case: allow-interactive-cases-keyed <reason>`.

**Known limitations (why an AST version was considered).** The regex heuristic:
- checks for `key` *presence*, **not distinctness** — the same literal `key="x"` on every case is still buggy (same key ⇒ no remount) but passes;
- uses a "nearest preceding def" heuristic to attribute hooks, and doesn't follow aliased imports (`import { useState as us }`);
- hand-rolls JSX tag scanning (`openingTagEnd`), which punts on `>` inside string-valued attributes and on `key` arriving via `{...spread}`;
- can false-positive on `key` placed on a *wrapping* element rather than the component.

**AST upgrade path (deferred — do this if distinct-key enforcement is wanted).** `.case.tsx` parses syntactically with the `typescript` package (already a repo dev dep) via `ts.createSourceFile(name, text, ScriptTarget.Latest, /*setParentNodes*/ true, ScriptKind.TSX)` — a **parse only**, no type-checker / no `Program`. Cost is ~1–5ms/file; gate it behind a cheap `text.includes('useState')` prefilter so only the few interactive files parse. The real cost is taking on `typescript` as a *direct tool dependency* (the static checks are deliberately parser-free today). You **cannot** piggyback on `loadModules` (it transpiles via Bun to runtime functions — JSX `key` attrs aren't recoverable from those). Suggested shape: a shared `parseCaseAst()` helper in `check-text.ts` (or a sibling), introduced when a *second* content-inspecting rule appears, then migrate this rule to it. AST buys: distinct-key comparison, exact scope/binding, reliable `key`/spread detection, fewer false positives.

---

## 2026-06-21: Display Case shell SSR + `publish` (hostable build)

Completes pre-scripting rendering (the browse shell now SSRs too) and adds a
`publish` command that builds a deployable showcase. See
`openspec/changes/archive/.../add-display-case-publish` once archived. Key
points for future agents:

- **Shell SSR is seed-based.** `useShell(seed)` takes `{manifest, route, theme,
  a11y}`; the server renders `<Shell seed>` from the in-memory manifest + the
  request route and inlines `window.__dcSeed`, the client hydrates from the same
  seed + live address. All render-affecting initial state (manifest, selection,
  mode, docs, nav, a11y) is seeded so it's deterministic on both sides; measured
  values (panel/content size, frame src) start at constants and update in
  effects. The one gotcha was `buildAddressUrl` reading `window.location.origin`
  *during render* — now it takes an explicit `origin` seeded empty and filled in
  an effect. Lesson: any `window` read in the render path (not an effect) is a
  hydration mismatch; grep for it when SSR-ing a stateful hook.

- **Shell renders in-process, no fresh-bundle dance.** Unlike cases (which need
  the per-rebuild `target:'bun'` bundle to dodge Bun's module cache), the shell
  depends only on manifest *data*, so `ssr-shell.tsx` imports `Shell` directly
  into the server process. The design-system components carry no module-load side
  effects (their CSS lives in co-located `.css` files inlined by the server, not
  injected), so importing them server-side is safe.

- **Dev vs prod servers share renderers, not envelopes.** `server.ts` (dev) and
  `prod-server.ts` (publish) both call the same React renderers (`ssr-shell`,
  `ssr-render`, `ssr-primer`) but use different HTML envelopes: dev injects
  live-reload + the error overlay and points at `/dist/*`; prod (`documents.ts`)
  drops both and points at content-hashed `/assets/*`. The envelopes genuinely
  differ, so they're separate templates rather than one over-parameterized one.

- **`publish` build shape** (`publish.ts`): minified hashed browser bundle →
  `out/assets/`; `target:'bun'` SSR bundles → `out/server/`; frozen
  `manifest.json` + `dc-build.json` (styles + asset map + base); `server.ts` +
  `package.json` + `Dockerfile`. `prod-server.ts` (a package export,
  `@awarebydefault/display-case/prod-server`) reads those and serves. `--static`
  crawls every address to HTML files; query-encoded variations resolve
  client-side (the documented, logged boundary).

---

## 2026-06-21: Display Case pre-scripting (server) rendering for `/render` + primer

The isolated `/render/<component>/<case>` and `/render/primer` documents now
ship their content as complete, themed HTML *before* the page's scripts run; the
client adopts (hydrates) it. Groundwork for a future "build production webapp"
export (host a Display Case beyond localhost). See
`openspec/changes/add-display-case-server-rendering/`. Non-obvious bits:

- **Why SSR is safe here at all: the theme is known at request time.** The one
  input that normally causes a server/client hydration mismatch is the theme; it
  comes from `?theme=` (and tweaks from `t.*`), so the handler bakes
  `data-theme` into `<html>` and renders the tree under it. First paint is
  correct (no flash) and adopt finds a matching tree.

- **The server can't `import()` case modules directly — Bun caches by path.**
  An in-process import returns the *stale* module after a watch rebuild (the same
  reason the manifest is built in a subprocess). So per request we **codegen a
  `target:'bun'` SSR entry, `Bun.build` it to a sequence-named file each rebuild,
  and `import()` that fresh path** (`server.ts` `rebuild()`; `ssrBuildSeq`). The
  bundle inlines case source from disk, so it tracks edits. React is `external`.
  A second such bundle serves the primer.

- **One tree, two callers.** `render-node.tsx` `caseTree()` is the pure, DOM-free
  tree builder; the server renderer (`ssr-render.tsx`) and the client mount
  (`ui/render-mount.tsx`) both call it, so markup can't drift. Document-level
  effects (theme on `<html>`, body background, fit width) live *outside* the tree
  and are set both server-side (in the HTML) and by the client (idempotent).

- **`data-ssr` on `#root` is the adopt switch.** `"1"` → client `hydrateRoot`;
  `"0"` → `createRoot` (the browser-only fallback path). A case that throws under
  `renderToString` (touches `window` etc.) is recorded, served empty, and mounted
  on the client; the server logs it and skips re-attempts until the next rebuild.

- **Adopt mismatches are logged, not fatal.** `hydrateRoot({ onRecoverableError })`
  logs `[display-case] adopt mismatch`; React re-renders that subtree. Clean
  hydration across the dogfood in both themes is the parity signal that
  visual-regression baselines won't move.

- **Refinement vs the proposal:** every case adopts (hydrates) — we do *not* drop
  the client bundle for "static" cases, because interactivity (an `onClick`) isn't
  knowable from a case's shape. Pure-static-no-bundle is left for a future
  explicit `static: true` opt-in.

- **Shell is deferred.** The browse shell (routes from `window.location`, owns the
  stage iframe whose case is already SSR'd, drives the SSE + a11y panel) stays
  client-rendered for now — modest no-JS value, real regression risk. Tasks
  3.1–3.2 in the change are a recommended follow-up.

### `ssr` check phase — enforce pre-render purity dynamically, not statically

The best-practice "don't use browser APIs in component render" is enforced by a
new `ssr` check phase (`src/checks/ssr-check.ts`), not a static lint. Rationale: a
static rule can't tell whether a `window` reference sits in render (breaks SSR)
or in an effect/handler (fine) — `TweaksPanel`'s `fixedBounds` reads `window` at
module scope but is only called from a `useEffect`, and a naive rule would
false-positive on it. So the check is *dynamic but browser-free*: it runs
`renderToString` over every case (in the one-shot check process, so bare imports
are current) and flags only the cases that actually throw. Zero false positives,
because it tests the exact property that matters. Runs alongside `structure`/
`tokens` as a third CI-friendly static phase. Opt out a genuinely browser-bound
component with `browserOnly: true` in its case meta (`defineCases`/`defineFlow`)
— that both skips the check and makes `ssr-render` serve it client-only.

---

## 2026-06-21: Display Case a11y start-up population (`a11y.startup`)

Resolves the "background-fill of all variants vs on-view only" open question
in the live-a11y entry below. New `config.a11y.startup: 'off' | 'cached' | 'refresh'`
(default `'off'`, i.e. the lazy behavior) controls how the nav is populated when
the server boots. `'cached'` emits every reusable cached verdict with **no**
scans; `'refresh'` additionally scans every uncached/stale variant. See
`openspec/changes/display-case-a11y-startup-ingest/` (archived).

Implementation:

- **`src/checks/a11y-scanner.ts`** — new `populateAtStartup(variants, mode)`. It reuses
  the **existing** `cachedViolations` reuse logic (so a start-up verdict is
  byte-identical to the lazy path) and the existing scan queue/`pump()`. `refresh`
  probes `ensureDriver()` **once** before enqueueing: if the browser can't launch
  it returns early rather than flooding the SSE channel with a burst of
  `unavailable` events (the on-demand path still reports `unavailable` on view).
- **`src/server/server.ts`** — calls `populateAtStartup` **detached** (`void`, not
  awaited) after the scanner is built, so scanning never delays the server
  becoming reachable. Variant list = manifest components × cases × configured
  themes (`config.a11y.themes ?? ['light','dark']`).
- **Late-join gap (non-obvious):** SSE only delivers events emitted *after* a tab
  connects, so a tab opened after the start-up burst would miss those `a11y`
  events and show an empty nav. Fix: the server records the latest verdict per
  `${component}__${case}__${theme}` in a `lastA11y` map (populated in the same
  `onResult` that broadcasts) and exposes it at **`GET /a11y/known`**. The client
  (`use-shell.ts`) fetches `/a11y/known` once on mount and folds each row through
  `applyA11yResult(..., fromScan: false)` — markers only, panel untouched (it's
  keyed to the viewed variant via `a11yCurRef`). `window.__displayCase` still
  carries only `{ reload, a11y, dev }`; verdicts ride the endpoint, not the
  injected config.
- **e2e** uses a dedicated `e2e/fixtures/consumer-startup` (a11y on +
  `startup: 'refresh'`) on its own webServer/port — the spec asserts the `Broken`
  marker appears *without* ever navigating to it, proving both the boot scan and
  the `/a11y/known` replay.

---

## 2026-06-20: Display Case live in-app a11y scanning + hot-reload

The browse server can surface accessibility results **in the chrome** (nav
markers + Accessibility panel), not only via the `check` CLI. Opt-in via
`config.a11y` (`{ enabled, themes, exclude }`); off by default because it uses
the optional Playwright + axe toolchain. See `openspec/changes/display-case-live-a11y/`.

Architecture:

- **`src/checks/a11y-scanner.ts`** — owns ONE lazily-launched render driver (reused, like
  `check.ts`) + a serial job queue, so scans never block request handling and the
  browser starts only on first scan. On-demand: only the viewed variant is
  scanned. Graceful degradation: if the driver can't launch, it flips to an
  `unavailable` status (the server keeps browsing) — never throws on the request
  path.
- **Cache** under `.display-case/a11y/<component>__<case>__<theme>.json` (gitignored).
  Key = a per-variant **transitive-import content hash**: crawl the `.case.tsx`'s
  in-package imports (regex + extension/index resolution, `node_modules`/bare
  specifiers skipped) + shared inputs (globalStyles) + the **tool version**
  (busts the cache when Display Case's own chrome/render changes). Validity is
  **layered**: stat the stored file set first (mtime+size, no reads); only on a
  stat mismatch re-crawl + content-hash to confirm a real change (so a
  touch-without-change doesn't re-scan).
- **Server (`src/server/server.ts`)**: `GET /a11y?component=&case=&theme=` →
  cached result | `pending` (enqueued) | `unavailable`. Completed scans push an
  `a11y` SSE event. Watch + live-reload are now the **default** for the
  interactive server (port ≠ 0), not just `--dev`; the watcher is broadened to
  component sources (`*.ts/tsx/css` + `*.placard.md`/mdx). A rebuild invalidates
  the scanner's in-flight bookkeeping (on-disk hashes still gate real re-scans)
  and pushes a `reload`. The scanner fetches the render doc with `?dcscan=1`,
  which omits the live-reload SSE script — otherwise the driver's
  `waitUntil:'networkidle'` would never settle against an open SSE.
- **Client (`src/ui/use-shell.ts`)**: reads `window.__displayCase`
  (`{ reload, a11y, dev }`, injected by the shell HTML). Requests `/a11y` per
  viewed variant + theme, applies SSE pushes, accumulates `byVariant` for nav
  markers. On `reload` (non-dev) it refetches the manifest + re-requests a11y
  while the **iframe reloads itself** (its own doc has the SSE script) — so
  selection + nav state survive (no full page reload). In `--dev` the shell still
  full-reloads (the chrome bundle may have changed).
- **Model**: `A11yViolation` gained `impact` (axe severity) — the panel orders
  worst-first and tags it. `A11ySurface.current` is
  `A11yViolation[] | 'pending' | 'unavailable'`; the panel only mounts when
  `a11y` is configured.

**`enabled` vs the CLI gate**: `a11y.enabled` controls ONLY the live surface.
`check --a11y` runs whenever invoked regardless (so a local-DX toggle can't
silently disable the CI gate), but both read the shared `themes`/`exclude` so the
panel and the gate agree on what's a violation. Verified live: the panel and
`check` both report color-contrast/label/select-name on TweaksPanel.

Future direction (not built): a static, host-able `build` mode (bake results in,
no Playwright at view time) as the opposite pole of the now-default interactive
run. Background-fill of all variants at start-up is now built — see the
`a11y.startup` entry above.

---

## 2026-06-18: Display Case component library (extracted + dogfooded)

The browse chrome's inline UI was extracted into a **self-contained component
library** at `src/ui/design-system/components/`
(`controls/` Button·IconButton·Input·Select, `showcase/`
Eyebrow·Chip·NavItem·Stage·FlowNav·TweaksPanel). Each is a pure component whose
`dcui-*` CSS lives in a **co-located `.css` file** (see the 2026-06-21 note below
— originally each *injected* its CSS at runtime via `inject-style.ts`). `shell.tsx`
consumes them; `chrome.css` was trimmed to shell **layout only** (the component
rules `.dc-btn/.dc-icon-btn/.dc-select/.dc-input/.dc-nav-*/.dc-flow-*/.dc-tweaks-*`
are gone — their styling lives with the components).

**Dogfooding:** the package now has its own `display-case.config.ts`
(`roots: ['src/ui/design-system/components/**/*.case.tsx']`), so Display Case
showcases its *own* components — browse with `bun src/cli.ts .`. Each component
has a colocated `*.case.tsx` (coverage lint enforces one per component) +
`*.placard.md`.

**Gotchas adding the config surfaced:**
- The `display-case-tokens` check now scans the *whole package*. Component-local
  CSS vars (Button's `--_bg/_fg/_bd`) and the render harness's consumer-token
  fallbacks (`--color-bg/_fg`, `--font-sans` in server.ts/chrome.css) get flagged
  as unknown tokens → list them in the config's `tokens.allow`.
- `globalStyles` are concatenated verbatim (no `@import` resolution), so list the
  individual token files, not `styles.css`.
- `index.ts` (and other barrels/utils) are `.ts` (not `.tsx`), so the coverage
  check (which derives `*.tsx` from the `*.case.tsx` roots) doesn't demand cases
  for them — keep utils/barrels as `.ts`. The co-located `*.css` files are
  likewise outside the `*.tsx` coverage surface.

### Display Case chrome split — exhibiting the chrome as page/template/flow

The browse chrome is split into three parts so it can be a *pure component* and
Display Case can dogfood **its own layout** as templates, pages, and a flow:

- `ui/use-shell.ts` — `useShell()`, the state machine (manifest load, address ↔
  selection sync, the stage crossfade + sizing math, the render/primer frame
  handshakes). Returns a `ShellViewModel` (or `{ manifest: null }` while loading).
- `ui/design-system/components/shell/ShellView.tsx` — a **pure** function of that
  model (props → JSX, no hooks, no `window`), decomposed into `ShellHeader` /
  `NavContents` / `LibraryStage` / `PrimerHost`. The live `<iframe>`s are passed
  in as `renderFrame` / `primerFrame` **slots**.
- `ui/shell.tsx` — a thin container: `useShell()` → builds the two iframes from
  the model → `<ShellView …>`. The browse entry still renders `<Shell/>`.

A case hand-builds a static `ShellViewModel` (see `shell/shell-fixtures.tsx`,
`makeModel(overrides)`) and slots either a real component or a placeholder onto
the stage — that's the whole dogfood. `shell-fixtures.tsx` carries a
`// display-case: no-case` escape (it's fixtures, not a component). The ladder:
`CaseTemplate`/`PrimerTemplate` (`level: 'template'`, placeholder slots),
`Button/RenderAddress/Sidebar/CaseTemplate/Primer` **pages** (`level: 'page'`,
real content), and `ShellView.case.tsx` (a `defineFlow` Primer → Cases, the mode
switch wired to `goto`).

**Gotchas this surfaced (each cost a debug cycle):**
- **The chrome-free `/render` doc needs the shell + component CSS for the
  dogfooded shell/component cases.** `ShellView`, the `page`/`template` cases, and
  the `dcui-*`/`dcpl-*` cases are all exhibited through `/render`, which carries no
  chrome of its own. Originally `ShellView` injected `chrome.css` at runtime and
  each component injected its `dcui-*` CSS, so they painted in `/render` once the
  client bundle ran. As of 2026-06-21 the server instead inlines the whole Vitrine
  stylesheet (`chrome.css` + every component `.css` + `primer.css`) into *every*
  document head — so these cases are styled **before scripts** (see that note).
  Safe to inline into every render doc only because the Vitrine CSS is fully
  `.dc-*`/`.dcui-*`/`.dcpl-*`-scoped (no `html/body/*`/`:root` rules), so it can't
  drift a consumer's component snapshots.
- **The exhibit's address must live on the model, not be derived in the view.**
  `buildAddressUrl` reads `window.location.origin`; the dev/check server uses an
  **ephemeral port**, so an address bar computed in the view changes every run and
  makes the chrome snapshots flaky. Moved it to `useShell` as `addressUrl`; the
  fixtures supply a fixed `https://display-case.dev/...` origin. Bonus: the pure
  view no longer touches `window`.
- **A primer skeleton of percentage-width boxes collapses.** `.dc-primer-inner`
  takes its width from content; a placeholder primer with only `width: NN%`
  children has no intrinsic width, so the inner shrinks and the bars become
  slivers. Use **absolute** (`rem`) widths for skeleton bars.
- **a11y is not a green baseline here.** `display-case check --a11y` is *not* part
  of the lint / pre-commit pipeline, and `main` already has ~67 violations
  (quiet-text contrast on the muted `--dc-fg-*` tokens, scrollable-region-focusable).
  The chrome-as-page exhibits surface more of the same — they're the real chrome's
  existing posture, not a regression. The gated regression signal is
  **e2e + unit + visual-regression** (all green).
- **Display Case `check --structure` supersedes a repo-local coverage lint.**
  The package ships a static structure-check phase
  (`src/checks/structure-check.ts`) whose `case-placard-coverage`
  rule is a strict superset of a bare "case file present" coverage lint
  (it also requires a sibling `*.placard.md`, not just a `*.case.tsx`). Drive it
  with `display-case check --structure --tokens` in the lint pipeline. The
  structure phase honors the same `// display-case: no-case`
  marker, plus `no-placard`, `allow-orphan`, `unclassified`, and per-rule
  `allow-<rule-id>` markers; rules and severities are configured under
  `check.structure` in `display-case.config.ts`. Composition (import-graph) rules
  are opt-in (default off).
- **`setup-present` uses a two-location toolchain probe.** The default visual
  backend (`check.ts` → `providers/playwright-driver`) resolves
  `playwright`/`@axe-core/playwright`/`pixelmatch`/`pngjs` relative to the
  Display Case package, *not* the consumer being checked. So
  `ruleSetupPresent` probes **both** locations — `Bun.resolveSync(pkg, dir)` for
  `dir ∈ [pkgDir, toolingDir]`, where `toolingDir` defaults to the display-case
  package (`import.meta.dir`) and is overridable via `StructureOptions.toolingDir`
  for tests — and reports "missing" only when *neither* resolves it and no custom
  `providers` are configured. This avoids a false miss for the normal consumer
  shape (toolchain provided transitively as display-case's optionalDependencies),
  while still catching a standalone consumer that has neither. A normal consuming
  package therefore needs **no** `setup-present` override; it only disables the
  optional `primer-present-and-used` if it authors no Primer. (An earlier version
  probed `pkgDir` only and over-reported; the per-showcase `setup-present: false`
  overrides were removed once the two-location probe landed.)

---

## 2026-06-18: Display Case has its own design system ("The Vitrine")

The browse chrome used to borrow `--color-*` tokens from a host app (a consuming
package), falling back to neutral gray + violet. It now has a **self-contained
visual identity** that lives in the package at `src/ui/design-system/`
(`styles.css` + `tokens/{fonts,colors,typography,spacing}.css`): warm paper
neutrals, a single marigold accent, Hanken Grotesk + JetBrains Mono, flat and
border-led. Everything is a `--dc-*` custom property.

**Wiring (server.ts):** `chrome.css` references only `--dc-*` tokens. At startup
`readDesignTokens()` reads `tokens/{colors,typography,spacing}.css` and
`shellHtml` inlines them *ahead* of `globalCss` + `chrome.css` so the chrome can
rely on them. Webfonts load via `<link>` (`FONT_LINKS`) in the document head —
not the `@import` in `fonts.css` — so the font declaration leads the document and
never collides with a consumer's own stylesheet `@import`s. The html/body reset
now paints `var(--dc-bg)` (was `var(--color-bg)`).

**Scope boundary:** only the **browse shell** is themed. The `/render` document
(`renderHtml`) stays consumer-token-driven (`--color-bg`/`--color-fg`/
`--font-sans`) — it is the exhibit's space and must show the component's real
tokens, not the chrome's.

**Signature touches in chrome.css/shell.tsx:** bracketed marigold wordmark
(`.dc-title::before/::after`), uppercase-mono eyebrow labels (`--dc-eyebrow`),
marigold active-nav row with a 2px left tick (`:has()` selector), mono `▾`
select caret (selects are `appearance:none` and wrapped in `.dc-select-wrap`),
and inputs with a marigold focus ring + glow.

**Stage = a centering viewport + a shrink-wrapping frame.** Two nested elements:
`.dc-preview` is the *stable* viewport — it fills the content column, is measured
(`attachPreview`) for the available area that drives responsive sizing, and
centers its child. `.dc-stage-frame` is the visible vitrine (border, radius,
grid, corner ticks). This split lets the frame size to the component without a
feedback loop, because the measured area never changes with it.

**Decoration is level-gated** (`stageDecor = component.level !== 'page' &&
!component.isFlow`, set as `data-decor` on `.dc-stage-frame`):
- **Decorated** (atom…template, unclassified): the frame *hugs the exhibit* with
  a dotted graph-paper margin + four corner ticks, and centers on the stage. It
  is **clipped to the component's own measured width *and* height**
  (`visibleW`/`visibleH`) so the frame takes only the space it needs instead of
  stretching to fill. It also has a floor — `min-width: min(22rem, 100%)`,
  `min-height: min(11rem, 100%)` — so a tiny component sits centered in a
  sensible stage instead of a sliver; the `min(…, 100%)` clamp keeps the floor
  from overflowing a narrow panel.
  - **Grid margin scales with room.** The padding is set *inline* (not CSS) by
    `gridPad(available, box)`: half the spare space, snapped to the 16px dot grid
    (`GRID`), clamped to 1–3 dots (`MIN_PAD`..`MAX_PAD`), per axis. So a small
    component gets the full 3 dots while one near max width gives the room back
    (down to 1 dot) instead of overflowing. `availW/availH` reserve only
    `MIN_PAD + 1px-border` per side, so a wide component can grow and shed
    padding. The grid `background-size` (16px) must stay == `GRID`.
  - **Transparent render bg.** The component sits *on* the stage backdrop: the
    chrome sends `transparent: stageDecor` (URL `?transparent=1` then via
    `dc-render`), and `render-mount` sets `document.body.style.background =
    'transparent'`; the iframe element (`.dc-frame`) is also `background:
    transparent`, so whatever the stage frame paints shows through wherever the
    case is itself transparent. Only the embedded browse iframe gets it —
    pages/flows never do (they paint their own opaque body), and the standalone
    `/render` endpoint stays opaque so visual-regression baselines keep a solid
    background.
  - **Backdrop toggle.** A header "Grid" toggle (`showGrid` state →
    `data-bg="grid"|"app"` on `.dc-stage-frame`) flips the stage backdrop between
    the dotted grid (on `--dc-surface`) and the consumer app's own background
    colour. The app colour is `var(--color-bg, var(--dc-surface))` — resolvable
    in the chrome because the consumer's `globalCss` is injected into the shell,
    and themed because the shell mirrors `data-theme` onto `<html>`. The toggle
    is pure chrome CSS (the iframe is transparent either way), so it never
    re-renders the frame. Only shown for decorated components.
- **Pages / flows**: the frame fills the viewport **edge-to-edge** (`width:100%`,
  `padding:0`, no grid/corners); `border-radius` + `overflow:hidden` clip the
  page to rounded corners.

**Content height comes from the render frame.** `render-mount.tsx` observes
`#root` with a `ResizeObserver` and posts `{type:'dc-size', size:{w,h}}` to the
chrome (measured off `#root`, whose block height is the content height regardless
of the iframe's viewport — `documentElement.scrollHeight` would clamp to it).
The shell stores it as `content` and uses `visibleH = min(content.h, innerH)`.
Crucially the iframe element stays **panel-tall** (`renderH = panel.h`) and the
`.dc-frame-box` clips it to `visibleH` (`overflow:hidden`) — so the component's
viewport (and any `vh` / media queries) never shifts as the visible box shrinks,
avoiding an oscillating shrink loop. `content` is reset on case change so a tall
page → short component re-measures cleanly. The clipping box (`boxW`/`boxH`) is
`Math.ceil(visible · scale)` on both axes: at a fitted scale the dimension is
fractional, and flooring it shaved a sub-pixel row/column — visibly cropping the
component's bottom/right border.

**Width-hug (so small components don't stretch).** A block/flex-rooted component
(e.g. `.account-menu { display:flex }`) fills any width it's given, so in a
full-width frame *every* component stretched. Fix: in the default **Responsive
(full)** view, decorated components are rendered with `fit` — the chrome sends
`fit: true` (URL `?fit=1` initially, then via `dc-render`), and `render-mount`
sets `#root { width: fit-content }` so the case shrink-wraps to its natural
width. The chrome measures it (`content.w`) and clips the stage to
`visibleW = min(content.w, targetW)`, hugging horizontally — symmetric with the
height hug. The iframe element still renders at the full `targetW` (stable
viewport for `vw`/media queries); only the visible box shrinks. `fitWidth =
stageDecor && !fixed && responsiveWidth === null`, so picking a preset/device
width opts back into full-width layout (responsive testing) and pages/flows never
fit. A component wider than the frame still fills, because `fit-content` caps at
the viewport and `visibleW` is capped at `targetW`.

**Fitted vs. manual-zoom sizing.** Any preset with fixed pixel dimensions must
auto-scale down so the whole view stays on-screen — not just device presets.
`fitted = fixed !== null || responsiveWidth !== null` covers **both** device
sizes (W×H — fit both axes: `min(availW/w, availH/h, 1)`) **and** the numbered
responsive widths (Desktop/Tablet/Mobile — fit width only: `min(availW/w, 1)`).
Only "Responsive (full)" uses the manual zoom buttons; every fitted mode shows a
static "scaled to fit" %. The fit divides by `availW/availH` — the panel minus
the reserved `MIN_PAD + 1px` per side for a decorated component — so the grid
margin is included and the frame never overflows. (Bug before this: numbered
widths used `manualZoom` with no fit, so e.g. Desktop 1280 on an 860px panel
overflowed instead of zooming to ~62%.)

**Chrome interaction details.**
- **Bracketed wordmark wraps.** `.dc-title` is an `inline-flex` (`align-items:
  stretch`) of `::before` bracket → `.dc-title-text` → `::after` bracket. The
  brackets are *border-drawn* (a bordered box minus its inner side), not glyphs,
  so they stay pinned at the ends (don't wrap into the text) and stretch
  vertically to the title's full height for any number of wrapped lines.
- **Toggle buttons share one "on" scheme.** `.dc-btn[aria-pressed="true"]` paints
  marigold (`--dc-brand` + `--dc-brand-subtle`). Both the **Grid** and **Docs**
  buttons carry `aria-pressed` (Docs also keeps `aria-expanded` for the
  disclosure semantics) — Docs keeps its label and just lights up instead of
  switching to "Hide docs".
- **Tweaks panel undocks into a floating overlay.** Per the design system, the
  `TweaksPanel` has `data-mode="docked"|"floating"` (shell `tweaksFloating`
  state, toggled by the `⬓`/`▭` bare icon button in its head). Floating is
  `position: fixed`, `width: 20rem`, `z-index: 50`, `--dc-radius-lg` +
  `--dc-shadow-overlay` (the one sanctioned floating surface), anchored
  bottom-right until dragged. The head is the drag handle (`⠿` grip,
  `touch-action:none`); `onPointerDown` captures the pointer and `onPointerMove`
  sets a clamped `{left,top}` so it roams the whole viewport — over the nav,
  header, and docs. Leaving floating re-anchors (clears the custom position).
- **Doc panel is drag-resizable from its left edge.** A `.dc-doc-resize` splitter
  (`role="separator"`, tabbable, arrow-key operable) is *absolutely positioned on
  the panel's left edge* (a full-height strip that brightens to marigold on
  hover) — not a floating line in the gap. So it stays pinned there, the panel's
  scroll moved to an inner `.dc-doc-scroll` wrapper (the panel itself is
  `overflow:hidden` + a positioning context). `startDocResize` tracks
  `pointermove` and sets `docWidth` (clamped `DOC_MIN_W`..`DOC_MAX_W`); dragging
  left widens. Width is applied via the `--dc-doc-w` custom property on the panel
  (`flex: 0 0 var(--dc-doc-w, …)`) so the `max-width:900px` stacking rule
  (`flex-basis:100%`) still wins and the handle hides.

**Source of truth:** the "Display Case Design System" project on claude.ai/design,
kept in sync via `/design-sync`. The token files in the package are vendored from
there; re-sync rather than hand-editing token values in isolation.

---

## 2026-06-18: Display Case render frame must block real anchor navigation

**Symptom:** clicking a link inside a showcased case/flow (e.g. an enrollment
"Confirmed" step's `<a href="/dashboard">Go to dashboard</a>`) broke the *entire*
Display Case — the content turned into a stray fragment and no further navigation
worked until a manual page reload.

**Cause:** a case/flow can legitimately render a real `<a href="...">` (a route
would supply a router `<Link>`), but the isolated render frame has no router. A
click does a full-document navigation to a non-render path; the DC server then
serves the **browse shell into the frame** (its catch-all returns shellHtml for
unknown paths), nesting a shell and severing the parent↔frame `postMessage`
handshake. Everything appears dead until reload.

**Fix:** `render-mount.tsx` installs a capture-phase click interceptor
(`blockFrameNavigation`) that `preventDefault`s anchor clicks which would unload
the frame. Same-document `#hash` links (in-page scroll) and `target=_blank` (new
context) are left alone. Flow `goto` advances use `<button>`, so they are
unaffected. This makes every case/flow robust regardless of how its link slots
are authored — no need to hand-audit each `<a href>`.

---

## 2026-06-18: Display Case bundles must inline `BUN_PUBLIC_*` env

**Symptom:** adding a case whose component transitively imports a module that
reads `process.env` at module top-level blanked the *entire* Display Case
showcase — every case rendered empty (htmlLen == shell), not just the offending
one. No console error (the throw happens during the single render-entry bundle's
module evaluation, before React mounts).

**Root cause:** a consuming package's API client ran `createApiClient(process.env.BUN_PUBLIC_API_URL
?? '…')` at module top-level. The consuming app inlines `BUN_PUBLIC_*` at build
time (`bun build … --env='BUN_PUBLIC_*'`, run from the app dir so Bun auto-loads
that app's `.env`). Display Case's `Bun.build` (`src/server/server.ts`) passed no env
handling and runs from a different directory, so the app's `.env` was never loaded
and `process.env.BUN_PUBLIC_API_URL` survived as a literal. In the browser
`process` is undefined → `process is not defined` throws on bundle load. All cases
share one `render-entry` bundle, so one throw blanks them all.

**Gotchas found while fixing:**
- `Bun.build({ env: 'BUN_PUBLIC_*' })` only inlines vars present in the env Bun
  snapshotted at **process startup** (+ the CWD-relative `.env` it auto-loads).
  Mutating `process.env` at runtime before calling `Bun.build` does **nothing**.
- The fix uses `define:` instead — `publicEnvDefines(pkgDir)` reads
  `<pkg>/.env[.local]`, keeps only `BUN_PUBLIC_*` (real exported env wins), and
  emits `{ 'process.env.X': JSON.stringify(value) }`. `define` replaces the
  literal unconditionally, independent of env timing. Scoped to the public prefix
  so secrets/NODE_ENV/ports never enter the bundle (mirrors the app's prod build).

**Render-time vs load-time:** the `define` fix unblocks *bundle load*. A case can
still throw at *render* — e.g. a component that renders a router `<Link>` throws
`useRouter must be used inside a <RouterProvider>` because the DC decorator
provides no router. Fix by inverting it to a `ReactNode`/render-prop link slot
(the route passes the real `<Link>`, the case passes a stand-in `<a>`). On-mount
`fetch`es to an absent API are fine: async, caught, they resolve to empty/loading
states.

**DC runtime backstop:** `server.ts` injects a classic inline script *before* the
module bundle that catches an uncaught `process/Bun is not defined` and paints an
explained banner — converting the silent blank into a visible error. (A build-time
bundle *scan* can't be used: framework code legitimately contains *guarded*
`process?.versions` etc., indistinguishable from an unguarded throw by regex.)

**Consumer-side guard (purity).** The reusable rule for a consuming package: a
component shown in Display Case must not reference any undefined-in-browser global
in its render/module path — *any* `process.*` / `Bun.*` / `import.meta.env` access
throws when bundled for the browser. A consumer's own lint can enforce this by
tracing *runtime* local imports across the module graph so a page can't launder an
impurity through a feature-local module (`import type` / fully type-only imports
are erased; external packages are an opaque boundary).

---

## 2026-06-17: Display Case flows (defineFlow) replace prototypes

`definePrototype` is gone; behavioural multi-step showcases use `defineFlow(name, { steps })`.
The top hierarchy level was renamed `prototype` → `flow` (`HIERARCHY_LEVELS`, the
sidebar group label, and `CaseModule.isPrototype` → `isFlow`).

Key design point: **a flow step is just an addressable case.** A flow emits a
`CaseModule` at the `flow` level whose `cases` are its steps, so discovery, slug
addressing, the `/render` endpoint, the manifest, and the visual-regression
runner all work on steps unchanged. Only two things are new:

- **`goto` navigates the harness, not local React state.** Each step's `render`
  receives `{ values, goto }`; `goto(step, overrides?)` resolves the target step's
  address and re-renders through the *same* internal `navigate()` that backs the
  `dc-render` postMessage path (`src/ui/render-mount.tsx`). So a transitioned-to
  step is immediately deep-linkable and screenshottable — that's the whole point
  vs. the old hand-rolled `useState`-in-a-case approach, whose later states were
  neither addressable nor captured by the checker.
- **`dc-step-changed`** is posted iframe→parent on `goto` so the browse chrome's
  sidebar/active-step and URL follow the in-iframe transition. The isolated
  `/render` endpoint has no parent, so snapshotting is unaffected.

Step presets reuse the tweak system: a step's `tweaks` defaults are its preset
state, and `goto('X', { error: true })` re-enters a step with overrides (encoded
into the address). `transitions` on a step is a declared list of target step
names — the catalog's source of truth for the flow graph, kept separate from the
imperative `goto` calls so the manifest stays static-analysable without rendering.

Typed step values: a **bare** flow step has loosely-typed `values`
(`TweakValues<TweakSchema>` collapses to `undefined` under
`noUncheckedIndexedAccess`). Wrap a step that reads typed `values` in the
`flowStep({ tweaks, render })` helper — it infers the step's own tweak schema so
`values.error` is `boolean`, no coercion. A type-inference spike (the
type-safe-flow-steps change) proved that compile-time checking of
`goto`/`transitions` step *names* cannot coexist with strict `values` in one
generic signature — making `defineFlow` generic over step keys discards each
step's literal `tweaks` and forces `values` loose again — so step names stay
string-typed (an unknown target renders the not-found step at runtime).

---

## 2026-06-17: WCAG gotcha — theme-flipped status tokens are TEXT tones, not fills

Display Case's a11y runner (`bun run display-case:check --a11y`) caught a real
dark-mode contrast bug worth remembering when adding any new component. The token
specifics are from the consuming design system Display Case was first dogfooded
against, but the *trap* and the *detection model* are reusable.

**The trap:** semantic status tokens (`--color-error/success/warning/info`) that
flip across themes — light mode = a **dark** shade (red-700, green-700, …) so they
read as **text on a light surface**; dark mode = a **light** shade (red-400, …) so
they read as **text on a dark surface**. They are tuned for *text*, not for
*fills*. Use one as a solid background with light text and the contrast inverts in
exactly one theme — a destructive button of `background: var(--color-error);
color: #fff` is fine in light (white on red-700) but **2.76:1 in dark** (white on
red-400). The fix pins the fill to a non-flipping primitive: `background:
var(--color-red-600)` (white ≥ 4.5:1 in both themes). Same caution applies to a
brand token that flips — pair it with its dedicated on-fill text tone (`-fg`),
don't pair a flipping token with a hardcoded `#fff`.

**Rule of thumb:** a `*-bg` token is the surface, the matching un-suffixed token is
text on that surface. For a *solid colored* surface with light text, use a fixed
mid-dark primitive (the `*-600` shades) so it survives both themes, plus the
token's `-fg` partner where one exists.

**Second trap (case files only):** several `.case.tsx` files used a token name from
a *different* design system (e.g. shadcn/Tailwind's `--muted-foreground`,
`--background`, `--foreground`) that does **not exist** in the consuming system. It
silently fell back to a hardcoded value that failed in dark. Don't import token
names from other design systems into a case.

**Detection — two layers guard this:**

1. **`display-case-tokens` (the cheap pre-filter).** A static check that flags any
   `var(--token)` in a showcased package that resolves to no custom property the
   package defines (in `globalStyles` or an inline `style` object). This catches
   the phantom-token half at commit time, before anything renders. The detection
   is **owned by Display Case** (`src/checks/tokens-check.ts`, exposed as the `--tokens`
   phase of `display-case:check`); a consuming package's lint just drives that
   phase over its `display-case.config.ts` and re-roots the findings. It is
   deliberately opinionated: a `var(--x, fallback)` is flagged even though the
   fallback makes it valid CSS, because the point is vocabulary conformance, not
   CSS validity. Escapes: `allow: unknown-token` per-line, or `tokens.allow` in
   the config for host-app-provided tokens. **It does not catch the
   fill-inversion** (that's a contrast fact, not a name lookup).

2. **The a11y runner (the authority).** It renders **every** case in **both**
   light and dark themes and runs axe `color-contrast`, so any fill-inversion or
   below-4.5:1 result in *either* theme fails. It is contrast-truth (measures
   rendered pixels), not a heuristic. Its only blind spot is coverage — it sees a
   defect only if a `.case.tsx` exercises that component+variant in both themes,
   which is why the coverage rule requires a case file per exported component.

Treat the token check as the fast pre-filter and the both-themes a11y run as the
guarantee.
