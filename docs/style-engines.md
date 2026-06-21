# Style engines (CSS-in-JS: MUI / emotion)

> Nav: [Quick start](quick-start.md) · [Writing cases](writing-cases.md) · [Hierarchy](hierarchy.md) · [Tweaks](tweaks.md) · [Theming](theming.md) · **Style engines** · [Documentation panel](documentation-panel.md) · [Writing placard docs](writing-placard-docs.md) · [Testing](testing.md) · [CLI](cli.md) · [AI agents](ai-agents.md) · [Configuration](configuration.md)

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
//   wrap(node)    — wrap the tree in the library's provider over a FRESH store
//   collect(html) — after render, return the <head> markup (style tags) it used
```

A fresh store per render is what keeps one case's styling out of another's
snapshot, so the engine must be a **factory** (`() => …`), not a single object.
Engines are configured on [`styleEngines`](configuration.md#styleengines), and
apply to the isolated `/render` document and the Primer — the two surfaces that
render your components in-document.

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

[`styleEngines`](configuration.md#styleengines) is an ordered array; engines nest
in array order (the first is outermost) and their head output is concatenated. Use
this only if a single showcase genuinely mixes two runtimes:

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
  Display Case places the string verbatim, after the document's static styles, and
  does not parse it.
- Pair with a **client provider in `decorator`** if your library does not adopt
  server styles automatically.

## See also

- [Theming](theming.md) — `globalStyles`, `decorator`, and `data-theme`.
- [Configuration › `styleEngines`](configuration.md#styleengines) — the field reference.
- [Configuration › `decorator`](configuration.md#decorator) — the provider you pair with an engine.
