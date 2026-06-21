## 1. Spike & wiring (Button, de-risking)

- [x] 1.1 Extract `Button`'s `const CSS` body to a sibling `Button.css`; remove the `injectStyle('dcui-button', CSS)` call and the `injectStyle` import.
- [x] 1.2 Add a `readVitrineCss()` helper (mirroring `readDesignTokens()`): read-and-concatenate, in path-sorted order, `chrome.css` + every `src/ui/design-system/components/**/*.css` + the primer chrome `primer.css`. Add it in both `src/server/server.ts` and `src/commands/publish.ts` (where `readDesignTokens` is duplicated).
- [x] 1.3 Wire `vitrineCss` into all three dev document builders in `src/server/server.ts` (`shellHtml`, `renderHtml`, `primerHtml`): inline it into each head `<style>`, replacing the shell's existing `chromeCss` slot (which `vitrineCss` supersets) and adding it to render + primer.
- [x] 1.4 Build & verify: fetch the shell and `/render/<comp>/<case>` HTML with scripts disabled and confirm the `.dcui-btn` rules are present in the head `<style>` (no FOUC).

## 2. Prod / publish wiring

- [x] 2.1 Add `vitrineCss` to the three `documents.ts` builders (`shellDoc`, `renderDoc`, `primerDoc`) option types and inline it, replacing the shell-only `chromeCss` slot.
- [x] 2.2 Replace the `chromeCss` field on `BuildDescriptor` (`publish.ts`) with `vitrineCss: await readVitrineCss()`; thread it through `prod-server.ts` `documentFor` to all three builders so `publish` and `publish --static` emit it identically.

## 3. Migrate the design-system components

- [x] 3.1 Migrate every remaining `dcui-*` component under `src/ui/design-system/components/controls/` and `showcase/`: CSS body → sibling `.css`, drop the `injectStyle(...)` call + import.
- [x] 3.2 Migrate the `shell/` components: `Stage.tsx` (`dcui-stage`) → sibling `.css`; in `ShellView.tsx` drop the `import chromeCss from '../../../chrome.css' with { type: 'text' }` and its `injectStyle('dc-chrome', chromeCss)` (the server now inlines `chrome.css` into every document).
- [x] 3.3 Migrate `src/ui/design-system/components/primer-specimen/styles.ts` (the shared `dcpl-*` specimen CSS) to a co-located `.css`; remove its `injectStyle` and, if `styles.ts` then exports nothing used, delete it and drop its importers.
- [x] 3.4 Migrate the primer chrome's own CSS in `src/ui/primer.tsx` (`dc-primer`) to a sibling `primer.css`; drop its `injectStyle` call.
- [x] 3.5 Grep-confirm no `injectStyle` references remain anywhere in `src/`.

## 4. Remove the runtime mechanism

- [x] 4.1 Delete `src/ui/design-system/components/inject-style.ts`.
- [x] 4.2 Delete `src/types/css-text.d.ts` (the `*.css` text-import declaration) once `ShellView` no longer uses it and nothing else imports `*.css` for text.
- [x] 4.3 Confirm the browser entry no longer relies on style injection for first paint.

## 5. Live-reload

- [x] 5.1 Re-read `vitrineCss` inside the dev rebuild in `server.ts` (next to the existing `chromeCss`/`tokensCss` re-read); the watcher glob already matches `.css`.
- [x] 5.2 Verify editing a component `.css` updates the running showcase without a full restart.

## 6. Verification

- [x] 6.1 `bun run lint` and `bun run typecheck` clean.
- [x] 6.2 `bun run check` (structure + tokens + ssr) passes.
- [x] 6.3 `bun run e2e` (chrome suite) passes.
- [x] 6.4 Visual-regression / `display-case-review` over the showcase to confirm no cascade-order drift in light and dark themes.
- [x] 6.5 Manually fetch `/render/<comp>/<case>?theme=dark` with scripts disabled and confirm the component is fully styled (no FOUC) — the scenario added to the `server-rendering` spec.

## 7. Documentation

- [x] 7.1 Update `src/ui/design-system/README.md` — the self-contained-styling section now describes co-located `.css` files read-and-concatenated and inlined server-side, not `injectStyle`.
- [x] 7.2 Update `contributing/coding-best-practices.md` — new convention: design-system component CSS is a co-located file inlined server-side; runtime style injection is disallowed.
- [x] 7.3 Update `contributing/NOTES.md` — record the `vitrineCss` read-and-concat wiring, why it inlines into the chrome-free `/render` (dogfooded cases), and the path-sorted cascade-order rule.
- [x] 7.4 Update the dogfood `display-case.config.ts` comment that claims "The components inject their own (dcui-*) CSS" — no longer true.
