## Why

Every themed document Display Case delivers — the isolated case render, the
browsing surface, the primer — declares the chosen theme as a `data-theme`
attribute that the showcase's tokens key off, and paints `--color-bg`/`--color-fg`
on the body. But it never declares the CSS `color-scheme` property. `data-theme`
is a custom attribute the user agent's own widget styling does not read; only
`color-scheme` re-themes user-agent-rendered controls (form controls, scrollbars,
the default `<button>`/`<input>` chrome). So under a **dark** theme every such
control still renders in its **light** default appearance.

A real report surfaced this as a false-looking a11y `color-contrast` failure: a
flow step's back link authored as `<button>` (with only `color: var(--color-muted)`
and no background) measured `#a3a3a3` muted-grey text on `#efefef` — and `#efefef`
is exactly Chrome's light-mode `ButtonFace` system color. The element's own
default control background showed through because the dark theme never reached the
user agent. The same content authored as an `<a>` passed, because an anchor has no
user-agent background and inherits the themed body. Reproduced in headless
Chromium: under `data-theme="dark"` with no `color-scheme`, a bare `<button>`'s
computed background is `rgb(239,239,239)`; adding `html{color-scheme:dark}` flips
it to the dark control background `rgb(107,107,107)`.

The harm is broader than one finding: any user-agent-styled control in a dark
preview renders in the wrong scheme, so dark-theme snapshots and visual baselines
capture light scrollbars and light form controls, and the a11y scanner measures
contrast against light control surfaces a real dark-color-scheme app would not
present. Display Case already commits to delivering each surface "themed for the
requested theme" before scripting; the user-agent color scheme is the one piece of
that theming currently omitted.

## What Changes

- **Every themed document declares a CSS color scheme that matches the requested
  theme**, delivered before scripting alongside the existing themed body, so
  user-agent-rendered controls (form controls, scrollbars, default button/input
  chrome) render in the requested theme instead of their light defaults. This
  covers the isolated case render, the browsing surface, and the primer.
- **The declared color scheme is maintained across an interactive theme switch.**
  When a viewer switches the preview theme in place (or the chrome drives an
  in-place swap of the isolated render), the document's declared color scheme
  updates to match, so user-agent controls re-theme with the rest of the surface
  and do not restyle out of sync.
- **No authoring or public-API change.** Cases, the manifest, addresses, and the
  published-build contract are unchanged. Documents differ only by the added
  color-scheme declaration.

This is a faithfulness fix, not a contrast fix: it makes the preview match a real
browser under the requested color scheme. It does **not** by itself resolve the
reported finding — a bare `<button>` under `color-scheme: dark` still has a grey
control background, so muted-grey-on-grey remains low-contrast. That is correctly
the consumer's to resolve (a global button reset in their `globalStyles`, or an
explicit transparent background), and is called out in the response sent back to
the reporter.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `server-rendering`: a new requirement that the themed document delivered before
  scripting SHALL declare a user-agent color scheme matching the requested theme,
  so user-agent-rendered controls present in that theme rather than their default
  light appearance, and SHALL keep that declaration matched when the theme changes
  interactively.

## Impact

- **Affected code:** `src/server/server.ts` (`renderHtml` — and the build-error
  render document — declare `color-scheme` matching `doc.theme`); `src/ui/render-mount.tsx`
  (`applyDocEffects` sets `document.documentElement.style.colorScheme` on first
  load and every in-place theme swap, idempotent with the baked-in value); the
  prod-server / publish document if it carries its own render-document template.
- **No public API or authoring change.** Addresses, the manifest, case authoring,
  and the published-build contract are unchanged.
- **Visual baselines:** dark-theme baselines for any case or chrome surface that
  exposes a user-agent-styled control (scrollbars, default form controls) may
  shift to the correct dark appearance and need re-baselining. The repo's own
  dark visual snapshots should be reviewed and updated as part of this change.
