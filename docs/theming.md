# Theming

> Nav: [Quick start](quick-start.md) · [Writing cases](writing-cases.md) · [Hierarchy](hierarchy.md) · [Tweaks](tweaks.md) · **Theming** · [Style engines](style-engines.md) · [Documentation panel](documentation-panel.md) · [Writing placard docs](writing-placard-docs.md) · [Testing](testing.md) · [CLI](cli.md) · [AI agents](ai-agents.md) · [Configuration](configuration.md)

Components render in an isolated document so what you see (and what the check runner screenshots) is exactly the component, with no showcase chrome leaking in. Theming is controlled in three places: global styles, an optional decorator, and per-render URL parameters. (For components styled by a runtime CSS-in-JS library like emotion/MUI, see [Render-time styling](#render-time-styling-css-in-js--mui) below.)

## Global styles

List your CSS entrypoints in the config. Their contents are concatenated and injected into both the browse shell and the isolated render document, so components render with their real tokens and styles.

```ts
// display-case.config.ts
import { defineConfig } from 'display-case'

export default defineConfig({
  title: 'Display Case',
  roots: ['src/components/**/*.case.tsx'],
  globalStyles: ['./src/tokens.css', './src/components.css'],
})
```

Paths are resolved relative to the package. A listed file that does not exist is silently skipped.

## Light and dark via `data-theme`

The isolated render reads a `theme` query parameter and sets it on the document root before rendering:

```
/render/tweak-control/variants?theme=light
/render/tweak-control/variants?theme=dark
```

It applies as `<html data-theme="light">` (or `"dark"`). The render document also sets `data-theme-pref` to the same value, so an app `ThemeProvider` rendered via the [decorator](configuration.md#decorator) (e.g. behind a nav `ThemeToggle`) initializes to the harness theme instead of re-resolving from the OS and fighting the `?theme=` selection. Any value other than `dark` is treated as light. Author your tokens against this attribute:

```css
:root[data-theme='dark'] {
  --bg: #111;
  --fg: #eee;
}
```

The check runner exercises **both** themes for every case, so a baseline is captured per theme. See [Testing](testing.md).

## Decorator

A decorator is a single React wrapper rendered around every case — the place for a theme provider, context, or a fixed frame.

```tsx
// display-case.config.ts
import { defineConfig } from 'display-case'
import { ThemeProvider } from './src/components/theme-provider'

export default defineConfig({
  title: 'Display Case',
  roots: ['src/components/**/*.case.tsx'],
  decorator: ThemeProvider,
})
```

The decorator accepts `{ children }` plus the active case's `level`, `sourcePath`, and `area` — so beyond cross-cutting context it can wrap page/flow cases in app chrome (nav/header/footer). It wraps the rendered case (and the viewport-width wrapper, if any) inside React `StrictMode`. Use it for cross-cutting context that every component needs; prefer per-case composition for anything component-specific. See [Configuration › decorator](configuration.md#decorator) for the full signature and the per-area chrome pattern.

## Render-time styling (CSS-in-JS / MUI)

Global styles and the decorator cover static CSS and providers. But **Material UI**
(and any emotion / styled-components library) emits its CSS *while a component
renders* — so server rendering keeps the markup but loses the styling, giving an
unstyled snapshot and a flash on first paint.

A **style engine** fixes that: it collects the render-time CSS during the server
render and delivers it before scripting. Configure it alongside the decorator —
the engine handles the server-side extraction, the decorator provides the
`ThemeProvider` your components need:

```ts
styleEngines: [emotionEngine],
decorator: ({ children }) => <ThemeProvider theme={theme}>{children}</ThemeProvider>,
```

See [Style engines](style-engines.md) for the full emotion/MUI recipe and the
contract for other libraries.

## Viewport width

In the **browse chrome**, the header carries a Chrome-DevTools-style device toolbar: a **Responsive** mode (full or a preset width — Desktop/Tablet/Mobile — with manual zoom) and **fixed device sizes** (1080p, 4K, laptop, iPad, iPhone, Pixel, Galaxy, or a custom `W × H` with a rotate button) that render the iframe at exact pixels and auto-scale to fit the panel. No URL parameter is involved — the toolbar sizes the iframe element directly.

For the **standalone `/render` endpoint** (snapshots, direct navigation), constrain the width with the `width` query parameter (in pixels) instead:

```
/render/page/dashboard?width=480
```

The case is wrapped in a centered container with `max-width: <width>px`. This is handy for previewing responsive behavior or capturing a narrow snapshot. Omit it for the default full-width render.

## See also

- [Configuration](configuration.md) for the full `globalStyles` / `decorator` reference and defaults.
- [AI agents](ai-agents.md) for combining `theme`, `width`, and tweak parameters into a single deterministic render URL.
