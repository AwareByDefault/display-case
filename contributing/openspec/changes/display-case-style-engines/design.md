## Context

Display Case renders every case server-side via `renderCaseToHtml`
(`src/render/ssr-render.tsx`), which calls `renderToString(caseTree(...))` and
returns `{ html, browserOnly }`. The primer renders the same way via
`renderPrimerToHtml` (`src/render/ssr-primer.tsx`). The resulting markup is
inlined into the isolated-render and primer documents
(`renderHtml` / `primerHtml` in `src/server/server.ts`; `renderDoc` / `primerDoc`
in `src/render/documents.ts` for prod/publish), whose head `<style>` blocks carry
`tokensCss + globalCss + reset + vitrineCss` — three **static** styling sources,
all read from disk and concatenated.

`caseTree` (`src/render/render-node.tsx`) already wraps every case in the
configured `config.decorator` and `StrictMode`. The decorator runs on **both**
server and client (it is part of the shared tree), so it is the right home for a
provider that must exist in both places — e.g. a MUI `ThemeProvider`.

What is missing is the other half of CSS-in-JS SSR. Runtime styling libraries
(emotion — hence Material UI — styled-components, goober, …) accumulate CSS into
a per-render store *as the tree renders*, then expose an API to read that store's
critical CSS back out *after* `renderToString`. Display Case never opens that
store nor reads it back, so the styling is lost on the server and only appears
once the client runtime runs → unstyled snapshot + flash. The browse shell is
unaffected directly: it embeds the case through a live `/render` `<iframe>`, so it
inherits whatever the render document delivers.

The existing `vitrineCss` wiring is the precedent for *static* head styling. This
change adds the **dynamic** counterpart: styling that can only be known *after* a
specific render, collected per render and injected as discrete head markup.

## Goals / Non-Goals

**Goals:**

- A typed seam that lets a showcase collect render-time (CSS-in-JS) styling and
  deliver it in the isolated-render and primer documents **before scripting**,
  deterministically, on the server.
- Per-render isolation (no cross-case style bleed) and client adoption without
  duplication (no flash, no double-inject).
- Zero new runtime dependency on emotion/MUI/any styling library; the per-library
  wiring is consumer code, shipped as a documented recipe with emotion/MUI as the
  flagship.
- Inert when unused: a showcase with no engines configured produces identical
  documents (byte-for-byte) to today.
- `browserOnly` cases remain exempt and never break the surrounding surface.

**Non-Goals:**

- Bundling a CSS file imported inside a case (`import './x.css'`) — still routed
  through `globalStyles`; a separate concern.
- A zero-runtime CSS-in-TS toolchain (Vanilla Extract, Linaria, MUI Pigment CSS).
  Those emit static CSS at build time → use `globalStyles`, not this seam.
- Collecting styling for the browse **shell chrome** itself (Vitrine-only; the
  case is iframed). The seam targets surfaces that render *consumer* components
  in-document: the isolated render and the primer.
- Auto-detecting the styling library. The seam is explicit; the consumer names
  the engine(s).

## Decisions

### 1. A per-render factory of collectors, not a single object

The config field is an **array of factories**:

```ts
// src/index.ts
import type { ReactNode } from 'react'

/** Collects the styling a single server render emits, and returns it as head
 *  markup. One collector instance is used for exactly one render. */
export interface StyleCollector {
  /** Wrap the tree about to be rendered in whatever provider the styling library
   *  needs so its render-time styling accumulates in this collector's isolated
   *  store (e.g. an emotion `CacheProvider` over a fresh cache). */
  wrap(node: ReactNode): ReactNode
  /** Given the already-rendered markup, return the `<head>` markup (e.g.
   *  `<style data-…>` tags) carrying the styling that render used. `''` if none. */
  collect(renderedHtml: string): string
}

/** Invoked once per server render to produce an isolated collector. */
export type StyleEngine = () => StyleCollector

export interface DisplayCaseConfig {
  // …existing fields…
  /** Engines that collect render-time (CSS-in-JS) styling and deliver it before
   *  scripting. Applied in array order (first is outermost). Omit for none. */
  styleEngines?: StyleEngine[]
}
```

- **Why a factory (`() => StyleCollector`), not a `StyleCollector` directly:** the
  SSR module is built once and reused across every request (`server.ts` imports
  `renderCaseToHtml` per rebuild, then calls it per request). A shared store would
  collect case A's styling into case B's document — violating per-render
  isolation. Calling the factory once per render guarantees a fresh, isolated
  store (a fresh emotion cache) every time.
- **Why `wrap` + `collect` (two phases):** runtime CSS-in-JS SSR is inherently
  two-phase — provide a store *before* render, read critical CSS *after* render.
  The pair maps 1:1 onto emotion's `CacheProvider` + `extractCriticalToChunks`,
  styled-components' `StyleSheetManager` + `getStyleTags`, etc. It is the minimal
  contract that fits all of them.
- **Why an array (ordered):** a showcase may use two runtimes (e.g. emotion +
  styled-components). Engines nest in array order; `collect` outputs concatenate.
  One engine is the common case; the array costs nothing and avoids a v2.

### 2. The seam lives in the renderers; the document gains a discrete head slot

In `renderCaseToHtml` (and the primer's `renderPrimerToHtml`):

```ts
const collectors = (config.styleEngines ?? []).map((make) => make())
let tree = caseTree(modules, config, state, NOOP_GOTO)
for (const c of collectors) tree = c.wrap(tree)        // first engine outermost
const html = renderToString(tree)
const headStyles = collectors.map((c) => c.collect(html)).join('')
return { html, browserOnly: false, headStyles }
```

`CaseHtmlResult` (and the primer result) gains `headStyles?: string`. The dev
document builders (`renderHtml`, `primerHtml`) and the prod builders (`renderDoc`,
`primerDoc`) gain an optional `headStyles` parameter, emitted **after** the base
`<style>` block as its **own discrete markup**:

```
…<style>…tokensCss…globalCss…reset…vitrineCss…</style>${headStyles}</head>
```

- **Why a discrete slot, not concatenated into the base `<style>`:** emotion (and
  peers) tag their SSR output with attributes the client runtime keys on to adopt
  it (emotion's `data-emotion="css …"`). Folding that CSS into our one big
  `<style>` would strip those markers and break client adoption → the flash and
  duplication return. The collector returns *complete tags*; we place them
  verbatim.
- **Why after the static block:** the static block carries tokens/reset the
  render-time styling builds on; emotion manages its own specificity, so source
  order after the base is correct and matches emotion's own SSR placement.
- **Only the render + primer documents** get the slot. The shell document does
  not render consumer components in-document (iframe), so it has no render-time
  styling to carry.

### 3. Client adoption is the styling library's job, paired via `decorator`

The seam covers the **server** half (isolate + extract). The **client** half — a
provider present during hydration so the runtime adopts the server styling and
keeps styling subsequent interaction — is the consumer's existing `decorator`.
The two are a matched pair:

- `styleEngines` → server-only: fresh store + critical-CSS extraction per render.
- `decorator` → both server and client: the `ThemeProvider` / context the
  components need (and, on the client, the cache the runtime adopts into).

For **emotion specifically**, the client runtime's default cache (key `css`)
**automatically adopts** any `<style data-emotion="css …">` already in the
document — so when the engine extracts with the default key, the client needs no
extra wiring and there is no flash. This is the property that makes emotion/MUI
the clean flagship. For a **custom cache key** or **styled-components**, the
matching client provider goes in the `decorator`, with its key/instance aligned
to the engine. The docs spell out both paths.

- **Why not put extraction in the `decorator` too:** the decorator is a React
  component inside the tree; it cannot see the post-`renderToString` markup, which
  is exactly what critical-CSS extraction needs. Extraction must live outside the
  tree, in the renderer — hence a separate seam.

### 4. `browserOnly` short-circuits before any engine runs

The existing `browserOnly` guard returns `{ html: '', browserOnly: true }` before
`renderToString`. Engines are applied only on the server-render path, so a
browser-only case never invokes an engine and emits no `headStyles`; the client
mounts it and its runtime styles it there. No change to the guard; just ensure the
engine application sits inside the already-rendered branch (and inside the
`try`, so an engine that throws degrades that one case to browser-only rather than
failing the document).

### 5. Inert-when-unused and determinism

- `styleEngines` absent/empty ⇒ `collectors` is `[]` ⇒ `tree` unwrapped, `headStyles`
  is `''` ⇒ the `${headStyles}` slot contributes nothing ⇒ documents are
  byte-identical to today. This satisfies the "documents unchanged" scenario.
- Determinism: engines run in array order; `collect` is a pure function of the
  rendered markup (emotion's extraction is deterministic given the markup). No
  filesystem or time input enters the seam, so the SSR check's purity guarantee is
  preserved.

## Risks / Trade-offs

- **A misbehaving engine throws under render** → it would otherwise fail the
  document. *Mitigation:* engine application sits inside the existing
  `try/catch`; a throw degrades that one case to `browserOnly` (empty server
  markup, one log line, client mounts it) — the same graceful path a browser-only
  component already takes.
- **Wrong cache key / missing client provider** → emotion would re-inject on the
  client (flash/duplication returns). *Mitigation:* the flagship recipe uses the
  default key (auto-adoption) and documents the custom-key/styled-components path
  explicitly, including the `decorator` pairing.
- **StrictMode double-render** (`caseTree` wraps in `StrictMode`) → `collect` must
  be idempotent w.r.t. a double render. *Mitigation:* emotion/styled-components
  extraction reads the final markup and is idempotent; documented as a contract
  requirement for any custom engine.
- **Per-render factory cost** (a fresh cache per render) → negligible vs. a
  render; required for isolation. Not cached, matching the renderer (the render
  itself isn't cached today either).
- **MUI without emotion** (Pigment CSS / styled-components default in some setups)
  → not served by the emotion recipe. *Mitigation:* Pigment CSS emits static CSS →
  `globalStyles`; styled-components → documented as the second engine recipe.

## Migration Plan

0. **Spike (de-risk the client-adoption claim first):** wire `styleEngines` end to
   end for the isolated render only, add the emotion engine to a scratch MUI case,
   and confirm `/render/<comp>/<case>?theme=dark` fetched **with scripts disabled**
   is fully styled, and that **with** scripts there is no flash and no duplicated
   `<style data-emotion>` (adoption works). This validates Decision 3 before
   spending effort on the primer + prod paths.
1. Add `StyleEngine` / `StyleCollector` types + `styleEngines` to `src/index.ts`;
   add `headStyles?` to `CaseHtmlResult` and the primer result type.
2. Apply engines + collect in `ssr-render.tsx` and `ssr-primer.tsx` (inside the
   already-rendered branch / `try`).
3. Add the discrete `headStyles` slot to `renderHtml` + `primerHtml` (dev,
   `server.ts`) and `renderDoc` + `primerDoc` (prod/publish, `documents.ts`,
   threaded through `prod-server.ts` and any `publish.ts` document construction).
4. Tests: a unit test that a configured engine's `wrap` is applied and its
   `collect` output lands in the document head; a test that no engines ⇒ identical
   document; a test that a `browserOnly` case emits no `headStyles`.
5. Docs: author `docs/style-engines.md` (the appendix below), cross-link from
   `theming.md`/`configuration.md`, update `README.md`, `contributing/NOTES.md`,
   and `openspec/config.yaml` (new **style engine** concept).
6. Verify: `bun run lint`, `bun run typecheck`, `bun run check` (structure +
   tokens + ssr), `bun test`, `bun run e2e`.

**Rollback:** reverting the commits removes the field and the slot; with no engine
configured nothing else changes. No persisted state.

## Open Questions

- Should Display Case ship a tiny first-party helper (e.g. a `display-case/emotion`
  subpath exporting a ready-made `emotionEngine`) to spare consumers the ~8-line
  recipe, while still taking emotion only as an **optional peer** (lazy-imported,
  never a hard dependency)? Leaning **no for v1** — keep the core dependency-light
  and ship the recipe as docs; revisit if the recipe proves to be copy-paste
  boilerplate everyone repeats.
- Should `collect` be allowed to also return a **rewritten body markup** (some
  libraries rewrite class names during extraction)? Emotion's
  `extractCriticalToChunks` does not require body rewriting for adoption, so v1
  keeps `collect` head-only. Revisit only if a target library needs body rewrite.

---

## Appendix: `docs/style-engines.md` (flagship authoring guide — emotion / MUI)

> This is the documentation deliverable. At apply time it becomes
> `docs/style-engines.md` and is cross-linked from `theming.md` /
> `configuration.md`. It is kept here so the guide is reviewable alongside the
> design.

# Style engines (CSS-in-JS: MUI / emotion)

> Nav: [Quick start](quick-start.md) · [Writing cases](writing-cases.md) · [Theming](theming.md) · **Style engines** · [Configuration](configuration.md)

Display Case delivers every surface **rendered and styled before scripts run**.
For static CSS that means [`globalStyles`](configuration.md#globalstyles); for a
theme provider or context it means the [`decorator`](configuration.md#decorator).
But libraries like **Material UI** style components with **emotion**, a runtime
CSS-in-JS engine that emits CSS *while the component renders*. Server rendering
keeps the markup but, without help, throws that styling away — so a MUI snapshot
comes back unstyled and a live preview flashes unstyled before the client runtime
catches up.

A **style engine** closes that gap. It does the two things a runtime CSS-in-JS
library needs on the server: give each render an isolated style store, then read
that render's critical CSS back into the document head **before scripting**.

## The shape of an engine

```ts
import type { StyleEngine } from 'display-case'

// A StyleEngine is a factory called once per server render. It returns a
// collector with two methods:
//   wrap(node)   — wrap the tree in the library's provider over a FRESH store
//   collect(html)— after render, return the <head> markup (style tags) it used
```

A fresh store per render is what keeps one case's styling out of another's
snapshot, so the engine must be a **factory** (`() => …`), not a single object.

## Material UI / emotion (the flagship)

Two pieces, working together:

1. **`styleEngines`** — the server-only emotion extractor (this seam).
2. **`decorator`** — the `ThemeProvider` your components need, on both server and
   client. On the client, emotion's default cache adopts the server styles
   automatically, so there is no flash and no duplication.

### 1. The emotion engine

```tsx
// display-case.style-engine.tsx
import createCache from '@emotion/cache'
import { CacheProvider } from '@emotion/react'
import createEmotionServer from '@emotion/server/create-instance'
import type { StyleEngine } from 'display-case'

export const emotionEngine: StyleEngine = () => {
  // A fresh cache per render → per-render isolation. Key `css` is emotion's
  // default, which the client runtime adopts automatically (no client wiring).
  const cache = createCache({ key: 'css' })
  cache.compat = true // required for extractCritical-style extraction
  const { extractCriticalToChunks, constructStyleTagsFromChunks } =
    createEmotionServer(cache)
  return {
    wrap: (node) => <CacheProvider value={cache}>{node}</CacheProvider>,
    collect: (html) =>
      constructStyleTagsFromChunks(extractCriticalToChunks(html)),
  }
}
```

### 2. Wire it into the config

```tsx
// display-case.config.tsx
import { defineConfig } from 'display-case'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { emotionEngine } from './display-case.style-engine'

const theme = createTheme({ /* your palette, typography, … */ })

export default defineConfig({
  title: 'My MUI library',
  roots: ['src/**/*.case.tsx'],
  // Server: extract emotion's critical CSS into the document head.
  styleEngines: [emotionEngine],
  // Server + client: the provider your MUI components need. CssBaseline is
  // optional but makes the preview match your app.
  decorator: ({ children }) => (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  ),
})
```

That is the whole integration. Now:

- `/render/<component>/<case>?theme=dark` fetched **without scripts** comes back
  **fully styled** — a real snapshot, not a skeleton.
- The live preview paints styled on first frame: **no flash of unstyled content**.
- When scripts run, emotion finds its `data-emotion` style tags already in the
  document and **adopts** them — nothing is re-injected or duplicated.

### Why the pairing

| Concern | Where it lives | Runs on |
| --- | --- | --- |
| Fresh emotion cache + critical-CSS extraction | `styleEngines` | server only |
| `ThemeProvider` / `CssBaseline` (and the client cache emotion adopts into) | `decorator` | server + client |

Keep their cache keys aligned. With emotion's default key (`css`) the client cache
is implicit and adoption is automatic — which is why MUI needs no client-side
engine code.

## Other emotion-like libraries

Any runtime CSS-in-JS library that exposes "provide a store, then read critical
CSS" fits the same `wrap` + `collect` contract.

**styled-components:**

```tsx
import { ServerStyleSheet, StyleSheetManager } from 'styled-components'
import type { StyleEngine } from 'display-case'

export const styledComponentsEngine: StyleEngine = () => {
  const sheet = new ServerStyleSheet()
  return {
    wrap: (node) => (
      <StyleSheetManager sheet={sheet.instance}>{node}</StyleSheetManager>
    ),
    collect: () => sheet.getStyleTags(), // reads the sheet, not the html
  }
}
```

styled-components does **not** auto-adopt the way emotion's default key does, so
add a matching client provider in your `decorator` if you see a re-style on
hydration.

## Multiple engines

`styleEngines` is an ordered array; engines nest in array order (the first is
outermost) and their head output is concatenated. Use this only if a single
showcase genuinely mixes two runtimes:

```ts
styleEngines: [emotionEngine, styledComponentsEngine]
```

## When you do *not* need a style engine

- **Static CSS** (Tailwind's compiled output, hand-written stylesheets, design
  tokens) → list it in [`globalStyles`](configuration.md#globalstyles). Tailwind:
  build your CSS, then point `globalStyles` at the output file.
- **Zero-runtime CSS-in-JS** (Vanilla Extract, Linaria, **MUI Pigment CSS**) →
  these emit static CSS at build time; treat the emitted file as `globalStyles`.
- **A component that must run in a browser anyway** → mark it
  [`browserOnly`](writing-cases.md); it is exempt from server styling and mounts
  (and styles) in the client. You lose the pre-scripting snapshot for that case.

## Contract for a custom engine

If you write your own engine, it must:

- Be a **factory** — return a new collector (and a new store) on every call. A
  shared store leaks one render's styling into another's document.
- Have an **idempotent `collect`** — the case tree renders inside `StrictMode`
  (it may render twice); `collect` must return the same styling regardless.
- Return **complete head markup** from `collect` (e.g. `<style …>…</style>`),
  including whatever attributes your client runtime keys on to adopt the styles —
  Display Case places the string verbatim and does not parse it.
- Pair with a **client provider in `decorator`** if your library does not adopt
  server styles automatically.

## See also

- [Theming](theming.md) — `globalStyles`, `decorator`, and `data-theme`.
- [Configuration › `styleEngines`](configuration.md#styleengines) — the field reference.
- [Configuration › `decorator`](configuration.md#decorator) — the provider you pair with an engine.
