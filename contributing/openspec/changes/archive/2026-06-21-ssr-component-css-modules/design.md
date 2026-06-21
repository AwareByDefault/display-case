## Context

The Vitrine design-system components (`src/ui/design-system/`) each declare a
`const CSS` template literal and call `injectStyle(id, CSS)` at module load.
`injectStyle` appends a `<style>` to `document.head` and **no-ops under Node**
(`typeof document === 'undefined'`). Consequences:

- Server-rendered documents (`render/documents.ts`, `server/server.ts`,
  `server/prod-server.ts`) inline only `tokensCss + globalCss + reset +
  chromeCss`. `chrome.css` is *shell layout only* — it explicitly excludes the
  `dcui-*` component appearance (see `chrome.css` header comments). So component
  styling is absent from first paint and only arrives once the browser bundle
  executes the module-load `injectStyle` calls → flash of unstyled content.
- The chrome-free `/render` document is the worst case: a snapshot fetched
  without running scripts comes back unstyled, undermining the
  machine-readable-snapshot guarantee.
- Styling depends on import order and a runtime DOM mutation — non-deterministic
  and invisible to anything that reads HTML without executing JS.

Today's inlining model is the anchor: `chrome.css` is read once with
`Bun.file(CHROME_CSS).text()` and concatenated into the head `<style>`, and
re-read on change (`server.ts:899`). The fix should slot component CSS into that
same model rather than invent a parallel one.

## Goals / Non-Goals

**Goals:**

- Component CSS is part of every server-rendered document's head, before
  scripts, deterministically — shell, isolated render, and primer; in dev,
  prod-server, and `publish` (including `--static`).
- CSS stays co-located with each component (a sibling file), authored as plain
  CSS, bundled by Bun. Zero client-side style injection; zero new dependency.
- Remove `inject-style.ts` and the `*.css` text-import declaration once unused.
- No change to class names, markup, public exports, or consuming-app coupling.

**Non-Goals:**

- CSS Modules *scoping* (scoped hashed class names). Out of scope — see Decision 1.
- A CSS-in-TS toolchain (Vanilla Extract / Linaria) or any build plugin.
- Reworking the tokens (`colors/typography/spacing.css`) or `chrome.css`
  layout mechanism — only the per-component appearance CSS moves.
- Switching from inlined `<style>` to content-hashed `<link>` assets (a possible
  later optimization for `publish`; not required here).

## Decisions

### 1. Plain co-located `.css` files, not CSS Modules

Each component gets a sibling stylesheet (`Button.tsx` → `Button.css`) holding
exactly today's `const CSS` body. The existing manual `dcui-*` / `dcpl-*`
namespaces are kept verbatim. The component module simply **drops** its
`injectStyle(...)` call (and the `injectStyle` import); it does **not** gain a
JS-side `import './Button.css'` — the stylesheet is delivered to the document by
the server (Decision 2), not pulled through the JS module graph.

- **Why not CSS Modules (`.module.css`):** the components select on hand-written
  class names *and* attribute selectors (`.dcui-btn[data-variant="primary"]`,
  `[aria-pressed="true"]`, descendant combinators). Module scoping rewrites only
  the leading class, forcing every component to import a `styles` object, thread
  `styles.btn` into `className`, and leaving attribute/state selectors and
  cross-element rules awkward. The namespaces already prevent collisions, so
  scoping buys little for a large, mechanical rewrite. Rejected for churn and
  selector friction.
- **Why not a JS-side `import './X.css'`** (the bundler route): the project
  already delivers its token CSS and `chrome.css` by **reading the files and
  concatenating them into the document `<style>`** (`readDesignTokens`,
  `server.ts`), never through the JS graph. Bundling component `.css` through
  the browser/SSR entries would instead emit per-entry CSS assets, raise the
  question of how a bare `.css` import behaves under `renderToString`, and split
  delivery across `<link>`/`<style>`. Reading-and-concatenating sidesteps all of
  it and matches the proven precedent. (A bare `import './x.css'` *is* a no-op
  under Bun's runtime — verified — but we avoid needing that property at all.)
- **Why not keep the template literal but collect it server-side** (a tiny SSR
  style registry — Option 1 from the investigation): viable and lower-churn, but
  keeps a bespoke runtime mechanism and an import-order contract. Real files
  read at serve time are simpler and live next to the component.

### 2. One aggregated Vitrine stylesheet, read-and-concatenated, inlined in every document

A single `vitrineCss` string is assembled by **reading and concatenating**, in a
stable sorted order, the complete set of Display Case's own chrome CSS:
`chrome.css` + every `src/ui/design-system/components/**/*.css` + the primer
chrome's `primer.css`. This mirrors `readDesignTokens()` exactly (read N files,
`join('\n')`). It is inlined into the head `<style>` of **all three** documents
— shell, isolated render, and primer — in both the dev host (`server.ts`) and
the prod/publish path (`documents.ts` + `prod-server.ts` + `publish.ts`).

- `vitrineCss` **replaces** the shell's current `chromeCss` slot (it is a
  superset — `chrome.css` is its first part) and **adds** the same blob to the
  render and primer documents, which previously carried no chrome/component CSS.
- The browser entry **no longer injects** anything; all chrome styling lives in
  the head before scripts. This keeps "render before scripts" literally true.
- **Why all three docs, including the chrome-free `/render`:** Display Case
  dogfoods its own design system — the 35 `*.case.tsx` under
  `src/ui/design-system/components/` (including `shell/` pages that use
  `chrome.css` `.dc-*` layout and `primer-specimen/` `dcpl-*` specimens) are
  viewed through `/render`. Today they are styled only because `injectStyle`
  fires client-side. Inlining the full `vitrineCss` into `/render` keeps every
  such case styled before scripts. The cost for a *non-dogfooding* consumer is a
  few KB of inert chrome CSS in a **dev-time-only** preview document (Display
  Case is never bundled into a consumer's app), which is an acceptable trade for
  one uniform mechanism over per-surface partitioning of chrome vs. content CSS.
- Inlining (not `<link>`) matches `chrome.css`/tokens today, so dev and
  `publish --static` behave identically — no extra request, no asset-order race.
- Determinism: files are sorted by path before concatenation, so cascade order
  never depends on filesystem iteration. Cross-component collisions are already
  prevented by the `dc-*` / `dcui-*` / `dcpl-*` prefixes.

### 3. `vitrineCss` is read at serve time and re-read on `.css` change

`server.ts` reads `vitrineCss` once at build time alongside `tokensCss`, and
re-reads it inside the debounced rebuild (where it already re-reads `chromeCss`
and `tokensCss`) so editing any component `.css` live-reloads. The dev watcher's
glob already matches `*.css`, so new sibling stylesheets are watched with no
change. `publish.ts` reads it once into the `BuildDescriptor` for the prod
server / static export. No JS module graph, no bundler step for CSS — therefore
no `renderToString` `.css`-import concern at all.

### 4. Live-reload watches `.css`

Today editing a component's CSS string reloads the module and re-injects.
Afterward, the dev rebuild re-reads `vitrineCss` on change — mirroring the
existing `chromeCss`/`tokensCss` re-read in the debounced rebuild. The watcher's
glob already matches `*.css`, so editing any sibling stylesheet triggers a
live-reload with no watcher change.

## Risks / Trade-offs

- **Cascade ordering across ~24 sheets** → Concatenating per-component CSS into
  one blob could change specificity outcomes if order shifts. *Mitigation:*
  fixed path-sorted order; the `dc-*`/`dcui-*`/`dcpl-*` prefixes prevent
  cross-component collisions; visual-regression review over the showcase to
  catch any drift.
- **Chrome CSS in the chrome-free `/render`** → a non-dogfooding consumer's
  isolated render carries inert Vitrine CSS. *Mitigation:* it is a dev-time-only
  preview document (never shipped to a consumer's app), the bytes are small, and
  it buys one uniform mechanism (see Decision 2). Revisit only if a consumer
  reports a real collision against a `dcui-*`/`dcpl-*` class.
- **Larger inlined HTML** (Vitrine CSS now in every document head) vs a cached
  `<link>` → *Mitigation:* matches the current `chrome.css`/tokens trade-off and
  is modest; a content-hashed `<link>` for `publish` is a later, separate option.
- **Mechanical rewrite scope (~22 components + primer-specimen)** → many files
  touched. *Mitigation:* the change is purely extract-CSS-and-drop-`injectStyle`
  per file with no logic change; gated by the SSR check and e2e chrome suite.

## Migration Plan

0. **Spike (de-risking):** convert `Button` (CSS body → sibling `Button.css`,
   drop `injectStyle`); add the `vitrineCss` read-and-concat helper; wire it into
   the shell + render + primer documents (dev); confirm `/render/<comp>/<case>`
   and the shell HTML are styled with scripts disabled, and live-reload of the
   `.css` works.
1. Add the `vitrineCss` read-and-concat helper and the document-slot wiring to
   all three builders, in both `server.ts` (dev) and `documents.ts` +
   `prod-server.ts` + `publish.ts` (prod/publish), replacing the shell-only
   `chromeCss` slot with the superset `vitrineCss`.
2. Migrate the remaining design-system components, `primer-specimen/styles.ts`,
   and `primer.tsx` mechanically: CSS body → sibling `.css`, drop `injectStyle`.
   Drop `ShellView`'s `chrome.css` text-import + injection (the server now inlines
   it everywhere).
3. Delete `inject-style.ts` and `src/types/css-text.d.ts` once no references
   remain; grep-confirm zero `injectStyle` usages.
4. Update the dev rebuild to re-read `vitrineCss`.
5. Docs: design-system README (self-contained-styling section now describes
   co-located `.css` read-and-concatenated server-side), `contributing/NOTES.md`,
   and `contributing/coding-best-practices.md` (new convention: component CSS is
   a co-located file inlined server-side, never runtime-injected).
6. Verify: `bun run check` (structure + tokens + ssr), `bun run e2e`, and the
   visual-regression review for cascade drift.

**Rollback:** reverting the commits restores `injectStyle`. No data or persisted
state is involved.

## Open Questions

- Should the aggregate be path-sorted-glob or a hand-maintained list? Lean glob
  + sort for determinism and zero-maintenance as components churn; revisit only
  if a specific cascade-order need makes an explicit ordered list worthwhile.
