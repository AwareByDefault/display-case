## 1. Spike & decision gate

- [ ] 1.1 Convert `Button` only: extract its `const CSS` body to a sibling `Button.css`, replace `injectStyle('dcui-button', CSS)` with `import './Button.css'`.
- [ ] 1.2 Confirm the server-side import does not throw under `renderToString` (run an SSR render of a Button case via `bun run check --ssr` or `--print-manifest` + a render). If a bare `.css` import is not a no-op in the Bun run/test runtime, decide the fallback (retain `{ type: 'text' }` import attribute + concatenated aggregate) and record it in `design.md` Open Questions.
- [ ] 1.3 Wire a temporary `componentsCss` slot carrying Button's CSS into `buildRenderDocument` and verify `/render/<comp>/<case>` HTML is styled with scripts disabled (fetch + inspect head `<style>`).

## 2. Aggregate stylesheet plumbing

- [ ] 2.1 Establish the component-CSS aggregate: a stable, sorted barrel that imports every design-system component `.css` (deterministic cascade order), bundled by Bun into one stylesheet text.
- [ ] 2.2 Expose the bundled aggregate as a `componentsCss` string to the document layer (read-as-text, mirroring how `chrome.css` is loaded in `server.ts`).
- [ ] 2.3 Add the `componentsCss` slot to all three document builders in `src/render/documents.ts` — shell, isolated render, primer — inlined into the head `<style>` after `chromeCss`.
- [ ] 2.4 Add the same slot to the dev host (`src/server/server.ts`) and the prod/publish path (`src/server/prod-server.ts`, `src/commands/publish.ts`), so `publish` and `publish --static` emit it identically.

## 3. Migrate the design-system components

- [ ] 3.1 Migrate every remaining `dcui-*` component under `src/ui/design-system/components/` (controls + showcase + shell): CSS body → sibling `.css`, `injectStyle(...)` → `import './X.css'`.
- [ ] 3.2 Migrate `src/ui/design-system/components/primer-specimen/styles.ts` (the shared `dcpl-*` specimen CSS) to a co-located `.css` consumed the same way.
- [ ] 3.3 Migrate the primer chrome's own `injectStyle` call in `src/ui/primer.tsx`.
- [ ] 3.4 Confirm no `injectStyle` references remain anywhere in `src/` (grep clean).

## 4. Remove the runtime mechanism

- [ ] 4.1 Delete `src/ui/design-system/components/inject-style.ts`.
- [ ] 4.2 Delete (or repurpose) `src/types/css-text.d.ts` if the `*.css` text-import declaration is no longer used.
- [ ] 4.3 Ensure the browser entry no longer relies on style injection for first paint.

## 5. Live-reload

- [ ] 5.1 Add the component `.css` files to the dev server watch set and rebuild the `componentsCss` aggregate on change (mirroring the existing `chromeCss` re-read), emitting a live-reload.
- [ ] 5.2 Verify editing a component `.css` updates the running showcase without a full restart.

## 6. Verification

- [ ] 6.1 `bun run lint` and `bun run typecheck` clean.
- [ ] 6.2 `bun run check` (structure + tokens + ssr) — confirm the ssr phase now exercises styling-present-before-scripting.
- [ ] 6.3 `bun run e2e` (chrome suite) passes.
- [ ] 6.4 Visual-regression / `display-case-review` over the showcase to confirm no cascade-order drift in light and dark themes.
- [ ] 6.5 Manually fetch `/render/<comp>/<case>?theme=dark` with scripts disabled and confirm the component is fully styled (no FOUC) — the scenario added to the `server-rendering` spec.

## 7. Documentation

- [ ] 7.1 Update `src/ui/design-system/README.md` — the self-contained-styling section now describes co-located bundled `.css` files, not `injectStyle`.
- [ ] 7.2 Update `contributing/coding-best-practices.md` — new convention: design-system component CSS is a co-located bundled file inlined server-side; runtime style injection is disallowed.
- [ ] 7.3 Update `contributing/NOTES.md` — record the aggregate-stylesheet wiring, the Bun `.css` import behavior found in task 1.2, and the cascade-order determinism rule.
