## Context

Acme UI has no isolated component browser. The conventional tool (Storybook) assumes a Vite or Webpack builder, but this monorepo is deliberately Bun-native: `apps/web` bundles with `bun build` and serves dev with `Bun.serve` HMR, and there is no Vite/Webpack anywhere. We also want the tool to be first-class for AI agents — an agent should be able to enumerate components and snapshot a single one without booting an app or driving the full browsing UI.

The existing `packages/ui/.preview/` directory is the proof that the Bun fullstack pattern works for this: a `Bun.serve({ routes: { '/': index } })` where `index` is an `import`ed `index.html` that references a `.tsx` entry, giving on-the-fly bundling + HMR for free. Display Case generalizes that one-off into an owned, reusable tool.

Display Case is the generic tool (its own package); Acme UI is its first consumer, supplying a config file and colocated case files.

## Goals / Non-Goals

**Goals:**
- A Bun-only component showcase: Bun bundler + `Bun.serve`, no Vite/Webpack.
- Colocated, type-safe case files that are trivial for humans and AI agents to author.
- **Atomic Design classification** (atom → molecule → organism → template → page) declared per case file, plus a composite **prototype** level for multi-page flows; the sidebar and manifest group/order by level.
- A browsing UI (component sidebar grouped by hierarchy level, preview pane, light/dark + viewport controls) with stable, deep-linkable addresses per case (and per prototype page).
- **Tweaks**: a typed controls panel that adjusts a case's declared inputs live, with values encoded in the address.
- An **inline documentation panel** that renders the component's `.prompt.md` as markdown, show/hide.
- **Accessibility checks** and **visual-regression checks** over the cases, runnable headlessly and exit-coded so they can gate.
- Machine endpoints: a JSON manifest that is a *directory of file references* (not inlined content) and a chrome-free per-case isolated render that honors a requested theme, suitable for deterministic screenshots.
- A **lint check** enforcing that every exported showcased component has a case file.
- Case coverage for all ~27 ui components.
- **Standalone-grade documentation** shipped in the package: a root `README.md`, a quick-start, tutorial/guide pages, and runnable examples — written as if it were its own published npm package with a docs site.
- Dev-only: never bundled into any deployed app.

**Non-Goals:**
- Not a docs site / MDX authoring tool, not a published npm artifact.
- No addon ecosystem, no interaction/play-function test runner in this change (room left for later).
- Not wired into CI in this change (the a11y/VR runners are exit-coded so CI can adopt them later, but adding a CI job is out of scope).
- No production runtime; Display Case ships in no app image.

## Decisions

### D1 — New generic package `packages/display-case`

Display Case is its own workspace package (`@awarebydefault/display-case`), not code inside ui, so any package can showcase its components. It exposes:
- a tiny authoring runtime (`defineCases`) imported by case files,
- a config type,
- a server/CLI entry that a consumer invokes via a script.

Consumers (starting with ui) add a `display-case.config.ts` and a launch script. **Alternative considered:** building the browser straight into ui — rejected because the user asked for a separate package and because the tool is reusable across packages (`apps/web` features could adopt it later).

### D2 — Case file convention: `*.case.tsx` + `defineCases`

A case file is colocated with its component and default-exports a typed registry:

```tsx
// button.case.tsx
import { defineCases } from '@awarebydefault/display-case'
import { Button } from './button'

export default defineCases('Button', {
  Default: () => <Button>Save changes</Button>,
  Variants: () => (
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      <Button>Default</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Delete</Button>
    </div>
  ),
})
```

Each case is either a `() => ReactNode` thunk or an object `{ tweaks?, render }`. The optional third argument carries component-level metadata, primarily the design-hierarchy `level` (see D2c):

```tsx
export default defineCases('Button', { Default: () => <Button>Save</Button> }, { level: 'atom' })
```

Render functions are **not** invoked at import time, so a case module is safe to import in the Bun server process (for the manifest) as well as in the browser bundle. **Alternative considered:** Storybook's "default export = meta, named exports = stories" — rejected as more magic and harder to import server-side without DOM. The explicit registry is more legible for AI authors and yields the manifest directly.

### D2a — Tweaks (typed controls)

A case may declare `tweaks`, a record of typed control descriptors built with small helpers, and receive the resolved values as the render argument:

```tsx
import { defineCases, tweak } from '@awarebydefault/display-case'
import { Button } from './button'

export default defineCases('Button', {
  Playground: {
    tweaks: {
      label: tweak.text('Save changes'),
      variant: tweak.choice(['default', 'outline', 'ghost', 'destructive'], 'default'),
      size: tweak.choice(['sm', 'md', 'lg'], 'md'),
      disabled: tweak.boolean(false),
    },
    render: (t) => <Button variant={t.variant} size={t.size} disabled={t.disabled}>{t.label}</Button>,
  },
})
```

Tweak descriptors are plain serializable metadata (`{ kind, default, options? }`), so the **same descriptor object** drives the browser controls panel, the manifest's tweak schema, and the server-side default resolution — no duplication. Current tweak values are encoded in the case address as query params (`?t.variant=outline&t.disabled=1`) and parsed back on load, making any tweaked state shareable and snapshottable. Supported kinds: `text`, `boolean`, `number`, `choice` (fixed options). **Alternative considered:** Storybook-style argTypes inferred from prop types — rejected; explicit descriptors keep the server import trivial and avoid a type-reflection step under Bun.

### D2b — Inline documentation panel

The preview offers a show/hide panel that renders the component's sibling `<component>.prompt.md` as markdown. The panel is omitted when no `.prompt.md` exists. The doc lives **outside** the isolated render iframe (it is chrome, part of the browse UI), so it never pollutes `/render` snapshots.

**Renderer decision — full Markdown via `react-markdown` + `remark-gfm`.** Display Case is built as a standalone, publishable package: its consumers will write arbitrary Markdown in their docs, not the narrow subset that ui's 24 `.prompt.md` files happen to use today (bold, inline code, fenced code, paragraphs, simple lists). A standalone tool that silently dropped headings, tables, links, blockquotes, ordered/nested lists, or task lists would be a poor citizen. Hand-rolling a correct CommonMark + GFM renderer is a real maintenance and correctness burden (the CommonMark spec alone is large; GFM adds tables, strikethrough, task lists, autolinks), so the conventional, well-maintained dependency is the right call here. Because Display Case is **dev-only and never shipped in an app artifact**, the usual bundle-size objection to a markdown dependency does not apply.

- Use `react-markdown` with `remark-gfm` for the doc panel, rendering standard CommonMark + GFM.
- Render fenced code blocks as styled `<pre><code>`; syntax highlighting is an optional later add (e.g. a rehype highlighter) and is out of scope for this change.
- Sanitize/escape by default (react-markdown does not render raw HTML unless explicitly enabled; leave raw HTML disabled) so a doc file can't inject markup into the chrome.

**Alternative considered:** the in-house subset renderer from an earlier draft — rejected once the package is explicitly standalone; constraining consumers' docs to a hand-maintained subset defeats the "behaves like its own npm package" goal. `docs/documentation-panel.md` documents that the panel renders standard CommonMark + GFM (raw HTML disabled, syntax highlighting not yet included).

### D2c — Design hierarchy and prototypes

Each case file's metadata carries a `level` from the fixed taxonomy `atom | molecule | organism | template | page | prototype`, ordered by increasing composition. The sidebar groups components under level headings in that order; an undeclared level falls into an "Unclassified" group rendered last. The level is plain serializable metadata, so it also appears in the manifest for agents to filter on. The fixed enum (vs. free-form tags) keeps grouping deterministic and the taxonomy honest to Brad Frost's Atomic Design.

A **prototype** is the new top level: it showcases a *multi-page flow* rather than a single component, authored with a dedicated helper that takes ordered named pages:

```tsx
import { definePrototype } from '@awarebydefault/display-case'

export default definePrototype('Sign-in flow', {
  pages: {
    'Request link': () => <RequestMagicLink />,
    'Check email': () => <CheckYourEmail />,
    'Signed in': () => <SignedInLanding />,
  },
})
```

`definePrototype` is sugar over `defineCases`: it sets `level: 'prototype'` and turns each page into an addressable case under the prototype, while recording their order so the preview can offer **flow navigation** (a step rail + prev/next). Each page renders one at a time and is independently addressable (`/c/sign-in-flow/<page>`) and snapshottable (`/render/sign-in-flow/<page>`), so an agent can capture any step. Because pages render inside the normal isolated iframe, interaction within a page behaves as in the real flow; cross-page navigation is driven by Display Case's step controls (and, where a page wires its own navigation, that still works within the iframe). **Alternatives considered:** (a) a single case that internally routes between pages — rejected because individual steps wouldn't be addressable or snapshottable; (b) prototypes that *reference* existing page-level cases by id — deferred as a possible later convenience; authoring pages inline is simpler for a first cut. Prototype pages carry no tweaks in this change (kept simple); tweaks remain a single-component-case feature.

### D3 — Discovery via `Bun.Glob` + codegen entry

The server uses `Bun.Glob` to resolve the consumer's configured `roots` (e.g. `src/components/**/*.case.tsx`). Because Bun's bundler needs static entrypoints (no Vite `import.meta.glob`), Display Case **codegens** the entry module(s) into a gitignored cache dir (`.display-case/` in the consumer package):
- `render-entry.tsx` (codegen) — imports every discovered case module + the config + the render mount; reads component/case/theme/tweaks from the URL and mounts exactly one case for the isolated render.
- `browser-entry.tsx` (static, in the package) — mounts the browsing shell. The shell fetches `/manifest.json` at runtime, so case modules are bundled **only** into the render entry, never into the chrome.

**As-built note (implementation deviation):** the entries are bundled with `Bun.build` to `.display-case/dist` and served by a plain `Bun.serve` fetch handler, rather than the HTML-import dev-server pattern sketched in the original draft. The server **watches** the consumer `src` tree and rebuilds on `*.case.tsx` / `*.prompt.md` changes; the browser is refreshed by a reload rather than in-page HMR. Rationale: the HTML-import path can't ingest a *dynamically generated* entry cleanly, and `Bun.build` gives full, robust control over codegen + output. The trade-off (manual reload instead of HMR) is acceptable for a dev tool and isolated behind the server module, so adding HMR later (e.g. a tiny reload socket) is a one-file change. The spec is behavior-only and does not require HMR.

### D4 — Routing and addresses

- Browse UI is a single page with path-based selection: `/c/<componentSlug>/<caseSlug>`; unknown routes fall back to the shell, which shows a not-found state for a missing case. Slugs are derived deterministically from the component name and case name (kebab-cased), so addresses are stable across restarts.
- The preview pane embeds the isolated render in an `<iframe src="/render/<componentSlug>/<caseSlug>?theme=...&width=...">`, so the chrome and the case are fully isolated (no style bleed, independent `data-theme` root).

### D5 — Machine endpoints (AI-facing)

- `GET /manifest.json` — a **directory of file references**, not a content dump. The server imports the codegen registry (render fns uncalled) and emits `{ title, components: [{ id, name, level, caseFile, promptDoc, cases: [{ id, name, browseUrl, renderUrl, tweaks, pages? }] }] }`. `level` is the hierarchy taxonomy value; for a prototype, `pages` lists each page with its own `browseUrl`/`renderUrl`. `caseFile`, `promptDoc`, and a case's `baseline` are **repo-relative paths**; `tweaks` is the serializable descriptor schema (kind + default + options). The manifest stays an index the agent navigates, then reads referenced files directly — keeping it small and stable rather than ballooning with markdown/source. **Alternative considered:** inlining `.prompt.md` contents — rejected per the directory principle; one extra read is cheap and keeps the manifest a ruleset/index.
- `GET /render/<component>/<case>?theme=light|dark&width=<px>` — the chrome-free isolated render from D4, used both by the iframe and directly by screenshot tools / the `preview_*` harness. `theme` sets `data-theme` on the render document root; default `light`.
- `--print-manifest` CLI flag — prints the same manifest JSON to stdout and exits, so an agent can enumerate components without keeping a server alive or opening a browser.

These three together satisfy the "AI-friendly" requirement: enumerate (`/manifest.json` or `--print-manifest`), then deterministically snapshot any single case (`/render/...?theme=`).

### D6 — Theming and global styles

The consumer config declares `globalStyles` (CSS entrypoints) and an optional `decorator` (a wrapper component). For ui: `globalStyles: ['../src/tokens.css', '../src/components.css']`. Theme is driven by `data-theme` on the render-document root (the same mechanism the app and `ThemeProvider` use), set from the `theme` query param in the isolated render and from a toggle in the chrome. Viewport width is applied by constraining the iframe width. This reuses ui's existing theming contract rather than inventing one.

### D7 — Config file shape

```ts
// packages/ui/display-case.config.ts
import { defineConfig } from '@awarebydefault/display-case'
export default defineConfig({
  title: 'Acme UI',
  roots: ['src/components/**/*.case.tsx'],
  globalStyles: ['./src/tokens.css', './src/components.css'],
  // decorator?: ({ children }) => <ThemeProvider>{children}</ThemeProvider>
  // baselineDir?: string  // where VR baselines are stored; default '.display-case/baselines'
})
```

`baselineDir` is optional and resolved relative to the consumer package. It defaults to the gitignored cache (`.display-case/baselines`), but a consumer may point it at a committed directory (e.g. `__screenshots__/`) to opt into shared/CI-gating baselines — see D8.

Launched from the consumer via a script: `bun run display-case` → `display-case packages/ui` (resolves the config relative to the given package). Root convenience script proxies to ui.

### D8 — A11y and visual-regression runners reuse the `/render` endpoint

Both checks are headless drivers over the **same `/render/<component>/<case>?theme=` endpoint** the iframe uses — so what gets tested is exactly what a viewer sees, and there is one render path, not two. The runner boots the Display Case server, enumerates cases from the manifest, and for each case + theme navigates a headless browser to its render URL.

- **A11y**: inject `axe-core` into the rendered page and collect violations per case/theme; aggregate and exit non-zero on any violation. Output names the case, theme, rule, and node.
- **Visual regression**: screenshot the render and compare to a recorded baseline PNG using a pixel-diff with a small threshold. Baselines live under the configured `baselineDir`, defaulting to the gitignored cache at `.display-case/baselines/<component>/<case>.<theme>.png`. Modes: `--update` records/refreshes baselines; default compares and exits non-zero on diff, writing a diff image next to the baseline for inspection.

With the default (gitignored) `baselineDir`, baselines are local-cache, so visual regression is an **iterative local workflow** (record a baseline, then catch unintended visual changes while you work) rather than a shared/CI gate. A consumer that wants gating sets `baselineDir` to a committed directory, which makes baselines shared and turns the default compare run into a true CI gate — the location override (D7) is exactly the seam that enables this without a code change.

Playwright is the headless driver (already a repo dependency via e2e), so no new browser stack. Both runners share one CLI: `display-case check --a11y --visual [--update]`. **Alternatives considered:** a separate static prerender for testing (rejected — drift from the real render path); Bun's experimental DOM/snapshot testing (rejected — cases need real layout/paint for VR and real a11y tree). Determinism for VR: fixed viewport, disabled animations (`prefers-reduced-motion` is already honored by the system), and fonts loaded before capture.

### D9 — Coverage lint check in the existing pipeline

A new check under `tools/lint/src/checks/` (e.g. `display-case-coverage.ts`) reads each showcased library's Display Case config, enumerates its exported components (from the package's public entry), and asserts a colocated `*.case.tsx` exists for each, failing with the names of any uncovered components. It is registered in `tools/lint/src/index.ts` and gets a `lint:display-case-coverage` script, matching the existing per-check pattern. This satisfies the `lint-pipeline` delta. **Alternative considered:** enforcing in Display Case startup only — rejected; coverage must fail the pipeline (pre-commit), not just warn at dev time.

### D10 — Documentation as a standalone product

The package ships docs at the quality of a published open-source tool, so a newcomer (or an AI agent) can adopt Display Case from the docs alone. Layout:

- `packages/display-case/README.md` — the front door: one-paragraph pitch, why-not-Storybook, install/prereqs, a 60-second quick start, a feature tour with small screenshots/snippets, and a table of contents linking into `docs/`.
- `packages/display-case/docs/` — guide pages, each focused and example-driven, ordered as a learning path:
  - `quick-start.md` — from zero to a running showcase with one case.
  - `writing-cases.md` — the `*.case.tsx` convention, `defineCases`, multiple cases per component, the no-side-effects rule.
  - `hierarchy.md` — Atomic Design levels, declaring `level`, and `definePrototype` multi-page flows.
  - `tweaks.md` — typed controls, the `tweak.*` helpers, URL-encoded state.
  - `theming.md` — `globalStyles`, decorators, light/dark, viewport width.
  - `documentation-panel.md` — colocated `.prompt.md` rendering.
  - `testing.md` — a11y checks and visual-regression workflow (baselines, `--update`, diffs).
  - `cli.md` — every command and flag (`display-case`, `check`, `--print-manifest`).
  - `ai-agents.md` — the manifest directory, `/render` snapshotting, recommended agent workflow.
  - `configuration.md` — `defineConfig` reference (every option, defaults).
  - `examples/` — copy-pasteable example case files (a plain case, a tweaks case, a multi-variant case) that double as the snippets referenced by the guides.

Docs are plain Markdown (no site generator built in this change) but structured with a clear nav order and relative cross-links so they could drop into a docs-site generator unchanged. Guides lead with a runnable example, then explain. The package's own `.prompt.md` (the tool authoring convention) stays the terse AI-facing reference; `docs/ai-agents.md` is the longer-form agent guide. **Alternative considered:** a single long README — rejected; the feature set (cases, tweaks, theming, testing, CLI, agents) is too broad for one page to stay navigable.

## Risks / Trade-offs

- **Codegen cache drift / stale entries** → entries live in a gitignored `.display-case/` dir, are regenerated on start and on glob changes, and are never committed; a `clean` removes them.
- **Server-side import of case modules pulls in component code** → safe because render fns are lazy and components are pure React; if a case module ran DOM/browser code at import it would break the manifest. Mitigation: `defineCases` keeps cases as thunks, and the convention (documented in a `.prompt.md` for the tool) is "no side effects at module top level."
- **Bun fullstack `Bun.serve` HTML-import API churn** → the pattern is already in use in `.preview/`; we isolate it behind the Display Case server so a future Bun API change is a one-file fix.
- **Authoring drift: components without cases** → discovery silently omits them at runtime (by spec), but the D9 coverage lint check fails the pipeline so a new component cannot land without a case.
- **Style isolation** → using an iframe for the render guarantees the chrome's styles never leak into a case and vice-versa, at the cost of a slightly heavier preview; acceptable for a dev tool. The doc panel is chrome (outside the iframe) so it never appears in `/render` snapshots.
- **Visual-regression flakiness** → font loading, animation, and sub-pixel AA cause false diffs. Mitigation: capture only after fonts are ready, disable animation, pin viewport/device-scale, allow a small per-pixel threshold, and store diff images for triage. Local-cache baselines sidestep cross-machine font-rendering differences (each contributor records their own); the trade-off is no shared baseline (see D8).
- **Tweak-state in the URL** → only serializable tweak kinds (text/boolean/number/choice) are supported, so a tweaked state is always reproducible from its address; non-serializable controls are intentionally not offered.

## Migration Plan

1. Scaffold `packages/display-case` (runtime incl. `tweak` helpers + server/CLI + browsing shell + doc panel) and add it to the workspace.
2. Add the a11y + visual-regression `check` CLI over the `/render` endpoint (Playwright + axe-core + pixel-diff).
3. Add the `display-case-coverage` lint check under `tools/lint/` and register it in the pipeline.
4. Add `display-case.config.ts` to ui, author `*.case.tsx` (with tweaks where useful) for all ~27 components, record VR baselines, and add the launch + check scripts.
5. Remove the untracked `packages/ui/.preview/` harness; add `.display-case/` to `.gitignore` (this also covers the local VR baselines cache).
6. Author the package's standalone docs (`README.md` + `docs/` guides + `examples/`, per D10), add the tool-level `.prompt.md`, and cross-reference from `packages/ui/README.md` and `AGENTS.md`.

Rollback: delete the package, the config, the lint check, the scripts, the baselines, and the case files; nothing else depends on it and no app imports it.

## Open Questions

_None outstanding._

**Resolved:**
- **Visual-regression baseline location** → defaults to the gitignored `.display-case/baselines/` cache dir (local, iterative workflow), and is overridable via `baselineDir` in `display-case.config.ts` so a consumer can point at a committed directory for shared/CI baselines (D7, D8).
- **Markdown renderer for the doc panel** → full CommonMark + GFM via `react-markdown` + `remark-gfm` (raw HTML disabled). As a standalone, publishable package, Display Case must render whatever Markdown its consumers write, not a ui-specific subset; the dependency is acceptable because the tool is dev-only (D2b).
