## 1. Config surface

- [x] 1.1 Add a `ThemeSignal` type and an optional `theme?: { signals?: ThemeSignal[] }`
      field to `DisplayCaseConfig` in `src/index.ts`, with JSDoc; keep it declarative
      (named conventions `'class' | 'bootstrap' | 'mui' | 'data-theme' | 'color-scheme'`
      plus custom `{ attribute; light?; dark? }` / `{ class; light? }`). No functions.
- [x] 1.2 Resolve the effective signal set (default `['class']` for the consumer
      signals, with `data-theme` + `color-scheme` always present) once where config is
      loaded server-side; surface it to the render layer.
- [x] 1.3 Add a `*.test-d.ts` type test pinning the `theme` config shape and rejecting
      a function-valued signal.

## 2. Shared theme-signal resolver

- [x] 2.1 Add a pure `resolveThemeSignals(theme, signals)` in the render layer
      returning `{ attributes, addClasses, removeClasses, colorScheme }`; unit-test it
      for each named convention, the custom mappings, dark-only class behavior, and
      that `data-theme` + `color-scheme` are always present.
- [x] 2.2 Fold the existing `data-theme-pref` handling into the resolver so all seams
      agree on which indicators appear (resolve the current shell-vs-render
      inconsistency).

## 3. Server (pre-scripting) seams

- [x] 3.1 Bake the resolved signals into the `<html …>` attributes/class and the
      `html { color-scheme: … }` rule in `src/render/documents.ts` (`shellDoc`,
      `renderDoc`, `primerDoc`).
- [x] 3.2 Same for the dev-server templates in `src/server/server.ts` (shell, isolated
      render, build-error, primer).
- [x] 3.3 Serialize the resolved signal set into `window.__dcSeed` (built in
      `src/server/server.ts` / `src/render/documents.ts`) so the client can re-emit it.
- [x] 3.4 Confirm `./prod-server` inherits the change via the shared `documents.ts`
      renderers (no separate template to update).

## 4. Client (interactive) seams

- [x] 4.1 Read the signal set from `__dcSeed` in `src/ui/browser-entry.tsx` / the seed
      types and thread it to the appliers.
- [x] 4.2 Apply the resolved signals (set/remove attributes, toggle classes, set
      `style.colorScheme`) in `src/ui/render-mount.tsx` `applyDocEffects`,
      `src/ui/use-shell.ts` theme effect, `src/ui/primer-mount.tsx`, and the
      `src/ui/primer.tsx` postMessage handler — replacing the individual
      `dataset.theme`/`colorScheme` writes with the resolver output.
- [x] 4.3 Apply the signals on the per-specimen `<Display>` forced-theme wrapper for
      its subtree.
- [x] 4.4 Add an SSR/adopt parity assertion that the baked signals equal the
      client-applied signals for a configured non-default set (no flash, no drift).

## 5. Capture-time `prefers-color-scheme` emulation

- [x] 5.1 In `src/checks/providers/playwright-driver.ts`, emulate the user-agent
      color-scheme preference to match each rendered theme, so visual and a11y captures
      of a preference-only component render in the requested theme.
- [x] 5.2 Add a test/fixture: a case that themes only via `@media (prefers-color-scheme)`
      captured under light and dark yields the matching appearances.

## 6. Framework integration e2e (real dependencies)

Prove the signals actually drive real components, not just that the attributes/classes
appear. Add an e2e fixture consumer package whose `package.json` installs the real
libraries as dev dependencies and authors a case per convention; drive it with
Playwright asserting each component's *computed style* changes when Display Case's
theme toggles. Display Case renders React, so each fixture is a React component using
that library's real CSS/runtime.

- [x] 6.1 Add an `e2e/fixtures/consumer-theme-frameworks/` package (or extend an
      existing fixture) with real dev dependencies: `tailwindcss` (class strategy),
      `@mui/material` + `@emotion/react` + `@emotion/styled` (CSS-variables mode),
      `bootstrap` (CSS), and `@vueuse/core` (for its convention constant). Pin
      versions in `bun.lock`; keep it isolated from the root install.
- [x] 6.2 Tailwind (class) case: a component styled with `dark:` variants against the
      compiled Tailwind stylesheet (class strategy). `display-case.config.ts` uses the
      default signal set (which includes `class`).
- [x] 6.3 MUI case: a `@mui/material` component under `CssVarsProvider` reading
      `data-mui-color-scheme`; fixture config enables the `mui` signal.
- [x] 6.4 Bootstrap case: a component using Bootstrap's CSS keyed off `data-bs-theme`;
      fixture config enables the `bootstrap` signal.
- [x] 6.5 VueUse: assert Display Case's default class name equals `@vueuse/core`'s
      `useDark` default (`dark`) via a dep-backed unit check — a Vue component tree
      cannot render in the React host, but its class convention is the one covered by
      6.2; document this explicitly.
- [x] 6.6 `e2e/theme-frameworks.spec.ts`: for each fixture case, load it in the running
      showcase, read a theme-sensitive computed style (e.g. `background-color`) under
      light, toggle to dark, and assert the computed style changes to the dark value —
      proving the real library re-themed off Display Case's signal. Fail if unchanged.
- [x] 6.7 Wire the fixture into the e2e setup (its own `.display-case/` install) the
      same way existing `e2e/fixtures/consumer*` packages are, so CI runs it.

## 7. Documentation

- [x] 7.1 Document the `theme` config option, the default signal set, the named
      conventions, and the custom mapping in the product docs (`docs/`, theming page).
- [x] 7.2 Add guidance that toggle-able components must read a page-controllable signal
      (attribute/class or `color-scheme` + `light-dark()`), and that
      `prefers-color-scheme`-only components follow the OS interactively but are honored
      in captures.
- [x] 7.3 Record the seam list and the declarative-not-function rationale in
      `contributing/NOTES.md`.

## 8. Verification

- [x] 8.1 `bun run lint`, `bun run typecheck`, `bun run check` (structure + tokens + ssr)
      all pass.
- [x] 8.2 `bun test` passes, including the new resolver, type, and parity tests.
- [x] 8.3 Drive the running showcase: a case using a `.dark` class and a case using a
      custom attribute both follow the toggle in both themes with no flash (verify via
      the chrome-free `/render` endpoint in both themes).
- [x] 8.4 `bun run e2e` passes — including the new framework-integration suite (§6) —
      and the repo's own baselines are unchanged by the default set.
- [x] 8.5 Add a changeset (`minor` — new opt-in config capability).
