## 1. Authoring API

- [x] 1.1 Add a `FlowStep` case kind to `src/index.ts`: optional `tweaks` (step preset state), a declared `transitions` target list, and a `render({ values, goto })` signature.
- [x] 1.2 Add `defineFlow(name, { steps })` producing a `CaseModule` at the `flow` level with a flow marker and per-step transition metadata, keeping the manifest static-analysable (no render execution at import time).
- [x] 1.3 Rename the top hierarchy level `prototype` → `flow` (`HIERARCHY_LEVELS` and the level type); remove `definePrototype` and its export.
- [x] 1.4 Export `defineFlow` and the new types; confirm `defineCases` types are unchanged (additive only).

## 2. Render harness

- [x] 2.1 In `src/ui/render-mount.tsx`, factor the existing `dc-render` in-place update and initial render into one internal `navigate(state)` function.
- [x] 2.2 For flow steps, inject `goto(target, overrides?)` that resolves the target step address (with tweak-encoded overrides), pushes history, and re-renders via `navigate(state)`.
- [x] 2.3 Resolve each step's preset `tweaks` defaults (merged with any address/override values) and pass them as `values` to the step render.
- [x] 2.4 Emit a `dc-step-changed` message to the parent on `goto`; ensure the isolated `/render` endpoint (no parent) is unaffected.
- [x] 2.5 Render a not-found state for an address naming a non-existent flow step.

## 3. Catalog & manifest

- [x] 3.1 Extend `src/catalog.ts`/`src/manifest.ts` so each step entry includes its stable address and `transitions` (target step ids), and the component entry carries the flow marker; remove any prototype-specific listing branch.
- [x] 3.2 Confirm `--print-manifest` and `/manifest.json` expose flow steps and transitions without rendering the browsing surface.

## 4. Browse chrome

- [x] 4.1 In `src/ui/shell.tsx`, present a flow's steps and render the active step in the preview; let the viewer select any step.
- [x] 4.2 Handle `dc-step-changed` to keep the sidebar's active-step highlight in sync when an in-step transition fires.

## 5. Migration & removal

- [x] 5.1 Migrate `packages/ui/src/components/sign-in-flow.case.tsx` from `definePrototype` to `defineFlow` (pages → transition-less steps, or add transitions where natural).
- [x] 5.2 Update docs that reference the prototype construct/level: `packages/display-case/README.md`, `display-case.prompt.md`, `docs/hierarchy.md`, `docs/writing-cases.md`, `skills/display-case-author-case/SKILL.md`, `packages/ui/README.md`.
- [x] 5.3 Grep the repo for remaining `definePrototype` / `'prototype'`-level references and resolve each.

## 6. Verification against spec

- [x] 6.1 Verify deep-linking to a step renders it directly with its preset state; verify isolated `/render` of a single step is chrome-free in light and dark.
- [x] 6.2 Verify a viewer can move between steps from the browsing surface, and that an in-step interaction advances to the target step in place (no reload) with the new step addressable immediately afterward.
- [x] 6.3 Verify a flow whose steps declare no transitions behaves as an ordered walkable sequence (the former prototype behaviour).
- [x] 6.4 Run `display-case:check` (a11y + visual-regression + tokens) and confirm each flow step is screenshotted as its own baseline.

## 7. Example & docs

- [x] 7.1 Add one example flow case under `apps/web/src/page-cases/` that reuses a pure presentational view and wires `goto` to its callbacks (sign-in flow), then delete the placeholder `example.case.tsx` if superseded.
- [x] 7.2 Document the flow construct and the presentational-purity convention in the Display Case authoring docs and in `apps/web` + `apps/admin` `src/page-cases/README.md`.
- [x] 7.3 Post-change review per AGENTS.md: update `docs/NOTES.md` / READMEs where the flow construct introduces something a future contributor must know.
