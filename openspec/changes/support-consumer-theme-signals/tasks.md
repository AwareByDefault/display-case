## 1. Config surface

- [ ] 1.1 Add a `ThemeSignal` type and an optional `theme?: { signals?: ThemeSignal[] }`
      field to `DisplayCaseConfig` in `src/index.ts`, with JSDoc; keep it declarative
      (named conventions `'class' | 'bootstrap' | 'mui' | 'data-theme' | 'color-scheme'`
      plus custom `{ attribute; light?; dark? }` / `{ class; light? }`). No functions.
- [ ] 1.2 Resolve the effective signal set (default `['class']` for the consumer
      signals, with `data-theme` + `color-scheme` always present) once where config is
      loaded server-side; surface it to the render layer.
- [ ] 1.3 Add a `*.test-d.ts` type test pinning the `theme` config shape and rejecting
      a function-valued signal.

## 2. Shared theme-signal resolver

- [ ] 2.1 Add a pure `resolveThemeSignals(theme, signals)` in the render layer
      returning `{ attributes, addClasses, removeClasses, colorScheme }`; unit-test it
      for each named convention, the custom mappings, dark-only class behavior, and
      that `data-theme` + `color-scheme` are always present.
- [ ] 2.2 Fold the existing `data-theme-pref` handling into the resolver so all seams
      agree on which indicators appear (resolve the current shell-vs-render
      inconsistency).

## 3. Server (pre-scripting) seams

- [ ] 3.1 Bake the resolved signals into the `<html …>` attributes/class and the
      `html { color-scheme: … }` rule in `src/render/documents.ts` (`shellDoc`,
      `renderDoc`, `primerDoc`).
- [ ] 3.2 Same for the dev-server templates in `src/server/server.ts` (shell, isolated
      render, build-error, primer).
- [ ] 3.3 Serialize the resolved signal set into `window.__dcSeed` (built in
      `src/server/server.ts` / `src/render/documents.ts`) so the client can re-emit it.
- [ ] 3.4 Confirm `./prod-server` inherits the change via the shared `documents.ts`
      renderers (no separate template to update).

## 4. Client (interactive) seams

- [ ] 4.1 Read the signal set from `__dcSeed` in `src/ui/browser-entry.tsx` / the seed
      types and thread it to the appliers.
- [ ] 4.2 Apply the resolved signals (set/remove attributes, toggle classes, set
      `style.colorScheme`) in `src/ui/render-mount.tsx` `applyDocEffects`,
      `src/ui/use-shell.ts` theme effect, `src/ui/primer-mount.tsx`, and the
      `src/ui/primer.tsx` postMessage handler — replacing the individual
      `dataset.theme`/`colorScheme` writes with the resolver output.
- [ ] 4.3 Apply the signals on the per-specimen `<Display>` forced-theme wrapper for
      its subtree.
- [ ] 4.4 Add an SSR/adopt parity assertion that the baked signals equal the
      client-applied signals for a configured non-default set (no flash, no drift).

## 5. Capture-time `prefers-color-scheme` emulation

- [ ] 5.1 In `src/checks/providers/playwright-driver.ts`, emulate the user-agent
      color-scheme preference to match each rendered theme, so visual and a11y captures
      of a preference-only component render in the requested theme.
- [ ] 5.2 Add a test/fixture: a case that themes only via `@media (prefers-color-scheme)`
      captured under light and dark yields the matching appearances.

## 6. Documentation

- [ ] 6.1 Document the `theme` config option, the default signal set, the named
      conventions, and the custom mapping in the product docs (`docs/`, theming page).
- [ ] 6.2 Add guidance that toggle-able components must read a page-controllable signal
      (attribute/class or `color-scheme` + `light-dark()`), and that
      `prefers-color-scheme`-only components follow the OS interactively but are honored
      in captures.
- [ ] 6.3 Record the seam list and the declarative-not-function rationale in
      `contributing/NOTES.md`.

## 7. Verification

- [ ] 7.1 `bun run lint`, `bun run typecheck`, `bun run check` (structure + tokens + ssr)
      all pass.
- [ ] 7.2 `bun test` passes, including the new resolver, type, and parity tests.
- [ ] 7.3 Drive the running showcase: a case using a `.dark` class and a case using a
      custom attribute both follow the toggle in both themes with no flash (verify via
      the chrome-free `/render` endpoint in both themes).
- [ ] 7.4 `bun run e2e` passes; the repo's own baselines are unchanged by the default set.
- [ ] 7.5 Add a changeset (`minor` — new opt-in config capability).
