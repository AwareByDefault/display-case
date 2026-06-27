# Design — emit-theme-color-scheme

## The gap, precisely

`src/server/server.ts:renderHtml` emits the isolated `/render` document as:

```html
<html lang="en" data-theme="dark" data-theme-pref="dark">
  …<style>html,body{margin:0}body{background:var(--color-bg);color:var(--color-fg);…}</style>…
  <body><main id="root">…</main>…</body>
</html>
```

`data-theme` is the hook the **showcase's own tokens** read (`[data-theme="dark"]{--color-bg:…}`).
It is *not* a hook the **user agent** reads. The user agent themes its own
rendered controls — the default `<button>`/`<input>`/`<select>` chrome, scrollbars,
spin buttons, the `accent-color` default — from the CSS `color-scheme` property
alone. With `color-scheme` unset (its initial value is `normal` ⇒ light), those
controls render light no matter what `data-theme` says.

The client mirror in `src/ui/render-mount.tsx:applyDocEffects` sets
`document.documentElement.dataset.theme` (and `.themePref`) but likewise never
touches `color-scheme`, so an in-place theme swap re-themes the tokens but leaves
user-agent controls in their prior scheme.

## Reproduction (headless Chromium)

Document with `data-theme="dark"`, body `background:#0a0a0a`, an element styled
only `color:#a3a3a3` (the dark `--color-muted`):

| element | `color-scheme` unset | `html{color-scheme:dark}` |
|---|---|---|
| `<a class="x">` (no UA bg) | effective bg `#0a0a0a` (inherits body) | `#0a0a0a` |
| `<button class="x">` (UA bg) | own bg **`rgb(239,239,239)`** = `#efefef` | own bg `rgb(107,107,107)` |

`#efefef` is the light-mode `ButtonFace` system color — exactly the background in
the report. `color-scheme: dark` moves the control to the dark `ButtonFace`. This
is the entire mechanism: the report's "flow loses the background" is a
misattribution; the differentiator was `<button>` (UA-styled) vs `<a>`
(not UA-styled), made visible by the missing color scheme.

## Decision: declare `color-scheme`, do not reset controls

Two ways to make a dark preview's controls look dark:

1. **Declare `color-scheme` to match the theme** (chosen). The standards-correct,
   one-line mechanism. It re-themes *all* user-agent surfaces (controls,
   scrollbars, `accent-color`) coherently, before scripting, with no per-control
   CSS, and it is exactly what a real app does when it opts into dark mode.
2. **Impose a user-agent reset on controls** (rejected). Display Case must render
   the showcased component *as authored*; injecting `button{background:none}`
   would mask real authoring issues and couple the tool to one reset opinion.
   Whether a control has a background is the component's concern, not the harness's.

So the fix declares the scheme and changes nothing else about how controls render.

## Where the value comes from

The theme is already decoded into `doc.theme` (`'light' | 'dark'`) in
`parseRenderState`. `color-scheme` takes the same token verbatim (`light` / `dark`
are valid `color-scheme` keywords), so no new state, parsing, or address surface
is introduced — it rides the existing theme exactly as `data-theme` does.

## Server: bake it into the document

In `renderHtml`, add `color-scheme:${doc.theme}` to the `html` rule that already
carries `margin:0`:

```css
html{margin:0;color-scheme:dark}
body{margin:0;background:var(--color-bg);color:var(--color-fg);…}
```

Setting it on `html` (the document root) lets it cascade to every control and to
the viewport scrollbar. It is delivered in the static `<style>` block — before
scripting — so the first paint already has correct user-agent theming and the
client finds a matching document (no flash, no restyle), consistent with the
server-rendering contract. The build-error render document (`renderErrorHtml`)
gets the same treatment so its themed body is internally consistent; the
shell/browse document already paints its own `--dc-*` surface and is out of scope
unless it, too, exposes UA controls (it does — scrollbars — so it is included for
parity).

## Client: keep it matched on swap

In `applyDocEffects`, alongside the existing `dataset.theme` write:

```ts
document.documentElement.style.colorScheme = state.theme
```

Idempotent on first load (it equals the baked-in value) and correct on every
in-place theme swap and in-flow transition, all of which route through
`applyDocEffects` via `navigate`. This is what makes the "maintained across an
interactive theme switch" scenario hold.

## Publish / prod-server

`src/server/prod-server.ts` serves the published render documents. If it shares
`renderHtml`, it inherits the fix; if it carries its own template, it gets the
same `color-scheme` line so a published showcase is themed identically to the dev
server. Confirm during implementation and keep the two templates in step.

## Scope boundary — not a contrast fix

With `color-scheme: dark`, a bare `<button>`'s background is the dark `ButtonFace`
(`rgb(107,107,107)`); `#a3a3a3` muted text on it is still ≈ 2.1 contrast (below
4.5). So this change does **not** flip the reported a11y finding — as rendered,
that is a genuine low-contrast control surface. The consumer's remedy (include
their button reset in `globalStyles`, or give the element a transparent
background) is the contrast fix; this change is the faithfulness fix that makes
Display Case's preview match a real dark-color-scheme browser. Both are recorded
in the response returned to the reporter.

## Verification

- Unit: `renderHtml` (and `renderErrorHtml`) for `theme: 'dark'` includes
  `color-scheme:dark` (and `light` for the light theme) in the document head;
  the existing `documents`/server render tests assert the new declaration.
- Browser: the headless reproduction above, asserted as a test or e2e probe — a
  bare `<button>` in a `theme=dark` render document computes a dark control
  background, and a light render document a light one.
- `applyDocEffects` sets `documentElement.style.colorScheme` to the active theme,
  and an in-place dark→light swap updates it (covered in `render-mount` tests or
  the e2e theme-switch flow).
- Re-baseline the repo's dark visual snapshots that include UA-styled controls.
- `bun run typecheck`, `bun run lint`, `bun test`, `bun run check`, `bun run e2e`.
