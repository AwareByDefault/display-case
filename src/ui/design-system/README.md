# Display Case Design System — "The Vitrine"

The self-contained visual identity for Display Case. It lives **inside** the
package so Display Case dogfoods it: the browse chrome (`../chrome.css`) is
styled entirely from these `--dc-*` tokens — no host-app library, no
ui tokens.

## Identity in one breath

Warm paper neutrals, a warm-ink primary, and a single **marigold** accent.
Flat and border-led so the showcased component is the exhibit. Has charm
(bracketed wordmark, stage corner ticks) but never decorates.

- **Type** — Hanken Grotesk (UI) + JetBrains Mono (labels / values / code /
  wordmark). Dense 14px base. Eyebrow labels are UPPERCASE mono, `0.08em`.
- **Icons** — Unicode glyphs only. No icon font, no SVG, no emoji.
- **Themes** — light + dark via `data-theme` on any scope. Dark is warm
  charcoal, never pure black.

## Files

| Path | What |
|---|---|
| `styles.css` | Entry point. `@import`s the four token files below. |
| `tokens/fonts.css` | Webfont declaration (Hanken Grotesk + JetBrains Mono). |
| `tokens/colors.css` | Paper ramp, marigold ramp, status hues, light + dark aliases. |
| `tokens/typography.css` | Families, size scale, weights, tracking, the eyebrow role token. |
| `tokens/spacing.css` | Spacing scale, radii, borders, elevation, motion. |

## Components

`components/` holds the library as **pure React components** — each keeps its
`dcui-*` CSS in a **co-located `.css` file** (`Button.tsx` → `Button.css`) and
consumes only the `--dc-*` tokens. The server reads every component `.css`, the
shell `chrome.css`, and the primer `primer.css`, concatenates them into one
**Vitrine stylesheet**, and inlines it into every document `<style>` before
scripts run (`readVitrineCss` in `../../server/server.ts`). There is **no
runtime style injection** — the components no longer touch `document` to paint.

| Group | Components |
|---|---|
| `components/controls/` | **Button**, **IconButton**, **Input**, **Select** |
| `components/showcase/` | **Eyebrow**, **Chip**, **NavItem**, **Sidebar**, **Stage**, **FlowNav**, **TweaksPanel**, **RenderAddress**, **Wordmark** |
| `components/primer-specimen/` | **ColorRamp**, **SwatchGrid**, **StatusList**, **GlyphGrid**, **DefinitionList**, **LayoutMock**, **TypeScale**, **FontFamilies**, **WeightSpecimen**, **SpacingScale**, **SpecimenBoxRow** |

The `components/primer-specimen/` group is **generic, prop-driven foundation
specimens** for building a Primer — feed them your own ramps, swatches, type
scale, spacing steps, and glyphs. Display Case's own Primer (the
`primer-specimens/` wrappers) is the worked example: each wrapper supplies
Display-Case-specific data to one of these primitives.

The browse chrome (`../shell.tsx`) is built from these, and Display Case
**dogfoods them as its own showcased components**: each has a colocated
`*.case.tsx` + `*.placard.md`, surfaced by the repo-root `display-case.config.ts`.
Browse them with:

```bash
bun run display-case   # or: bun src/cli.ts .
```

`chrome.css` keeps only shell *layout* (grid regions, the stage/preview sizing,
the doc panel); the component-level styling lives with the components.

### The chrome as a pure component (`components/shell/`)

The browse chrome is split so it is itself a pure, exhibitable component:
`ui/use-shell.ts` (the `useShell()` state machine) → `components/shell/ShellView.tsx`
(a pure function of the `ShellViewModel`, with the live iframes passed in as
`renderFrame` / `primerFrame` slots) → `ui/shell.tsx` (a thin container). That
lets Display Case **dogfood its own layout**: `components/shell/` adds `template`
cases (Case/Primer templates, placeholder slots), `page` cases (Button,
RenderAddress, Sidebar, Primer, Case-template pages — real content slotted in),
and a `flow` (`ShellView.case.tsx`, Primer → Cases). They share
`shell-fixtures.tsx` (a `// display-case: no-case` helper). `ShellView` paints
inside the isolated `/render` doc because the server inlines the whole Vitrine
stylesheet — `chrome.css` included — into *every* document (the shell pages use
its `.dc-*` layout). See `../../../contributing/NOTES.md` for the gotchas
(render-doc CSS, snapshot determinism, primer skeleton widths).

## How the chrome consumes the tokens

`startDisplayCase` (in `../../server/server.ts`) inlines the token CSS into the
browse-shell `<style>` ahead of `chrome.css`, and injects the webfont
`<link>`s into the document head. Everything references `var(--dc-*)`; nothing
hard-codes a color, radius, or font.

Source of truth: the **Display Case Design System** project on
claude.ai/design, kept in sync via `/design-sync`.
