## Why

The Vitrine's design-system components style themselves by calling `injectStyle`
at module load — a client-only side-effect that no-ops under Node — so their CSS
is **absent from every server-rendered document** and only appears once the
browser bundle executes. The result is a flash of unstyled content on first
paint, and a chrome-free `/render` snapshot retrieved without running scripts
comes back unstyled. That contradicts the server-rendering promise (content
delivered "laid out and themed" before scripts) and the machine-readable-snapshot
guarantee. Co-locating CSS with a component is the right instinct; doing it via a
runtime DOM mutation is the wrong mechanism.

## What Changes

- Move each design-system component's `const CSS` template literal into a
  co-located CSS file next to the component (e.g. `Button.tsx` → `Button.css`),
  bundled by Bun into a single static component stylesheet asset.
- Wire that bundled component stylesheet into all three SSR documents (shell,
  isolated render, primer) and into the prod-server / `publish` output, so
  component styling is present in the `<head>` **before scripts run** — on the
  server, deterministically.
- Remove the `injectStyle` runtime mechanism (`inject-style.ts`) and the `*.css`
  text-import ambient declaration once nothing depends on them.
- Make the server-rendering behavior explicit that the *styling* needed to
  present content as it appears interactively — not just the markup — is
  delivered before scripting (no flash of unstyled content), including for the
  isolated chrome-free render.

This is zero-runtime: no client-side style injection, no import-order side
effects, and one less dependency-shaped pattern to maintain.

## Capabilities

### New Capabilities

- _None._ This is an internal architectural change to how Display Case's own
  browse chrome (the Vitrine) delivers its component CSS.

### Modified Capabilities

- `server-rendering`: strengthen the pre-scripting requirement to state
  explicitly that the styling required to present the content as it appears once
  interactive SHALL be delivered before scripting — so a surface (including the
  isolated, chrome-free render) retrieved without executing scripts is rendered
  *and* styled, not just structurally present. Today "laid out and themed" is
  satisfied for tokens and shell layout but silently violated for component
  appearance; this makes the promise unambiguous and testable.

## Impact

- **Affected code (chrome only — no product API change):** the 22 design-system
  component modules under `src/ui/design-system/` plus the shared
  `primer-specimen` styles; `src/ui/design-system/components/inject-style.ts`
  (removed); `src/types/css-text.d.ts` (removed/repurposed); the SSR document
  builders in `src/render/documents.ts` and `src/server/server.ts`; the primer
  and render entries (`src/ui/primer.tsx`, `src/render/`); and the build/serve
  CSS wiring in `src/server/prod-server.ts` and `src/commands/publish.ts`.
- **Build:** relies on Bun's native CSS handling (`Bun.build`) to emit the
  component stylesheet as a bundled, content-hashable asset; no Vite/Webpack and
  no new runtime dependency.
- **Surfaces that benefit:** `render-endpoint` (chrome-free snapshots become
  styled pre-script) and the visual-regression / SSR checks (no longer racing
  client injection).
- **Docs:** `src/ui/design-system/README.md` (the self-contained-styling
  pattern), `contributing/NOTES.md`, and `contributing/coding-best-practices.md`
  (the new co-located-CSS convention replacing `injectStyle`).
- **No consuming-app coupling, no public-export changes:** `index.ts`,
  `./tokens-check`, and `./prod-server` surfaces are untouched.
