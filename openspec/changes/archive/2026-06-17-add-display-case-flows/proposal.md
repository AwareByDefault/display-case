## Why

Page-level design work for the consuming apps is moving into Display Case (design the page as a case first, then wire it into a route). Reviewing a page in isolation is not enough — most pages are *behavioural*: a viewer clicks through states (submit a code, see the error, reach confirmation). Today the only way to demonstrate that in-page progression is to hold local state inside a single case, but those later states are then neither individually addressable nor captured by the visual-regression checker, and the page's view component gets entangled with navigation logic — defeating the design-first goal of reusing the same view in the real route. The existing static prototype construct gives ordered, addressable pages but cannot model in-page transitions or preset step state.

## What Changes

- Introduce an **interactive flow** construct: a showcased entry comprising ordered, named steps, where an interaction within a rendered step can trigger a transition that makes another named step the active step.
- Each flow step is **individually addressable and snapshottable**, exactly as prototype pages were.
- A flow step **carries preset values** for the variant it renders, so one presentational view can serve many steps (filled, error, confirmed) without duplicating the view.
- Transitions change the active step **in place**, reusing the existing live-update path so navigation does not reload the catalog.
- The machine-readable catalog lists each flow's steps with their addresses **and their outgoing transitions**, so an agent can walk the flow graph.
- **BREAKING**: the static prototype construct is **removed** and replaced by the flow construct. A former prototype (an ordered page sequence) is expressed as a flow whose steps declare no transitions. The top hierarchy level formerly named `prototype` is renamed `flow`.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `display-case`: replaces the static "Prototype multi-page flows" requirement with an interactive flow construct (named steps + preset step state + in-step-triggered transitions), renames the top hierarchy level from `prototype` to `flow`, and extends the machine-readable catalog to expose flow steps and their transitions.

## Impact

- **Spec**: `openspec/specs/display-case/spec.md` — removes "Prototype multi-page flows"; modifies "Design-hierarchy classification" (level rename) and "Machine-readable catalog" (flow steps + transitions); adds "Interactive flow steps" and "Flow transitions".
- **Package** `packages/display-case`: authoring API (`src/index.ts` — remove `definePrototype`, add `defineFlow`, rename the level), the render harness and its live-update message path (`src/ui/render-mount.tsx`), catalog/manifest building (`src/catalog.ts`, `src/manifest.ts`), the browse chrome (`src/ui/shell.tsx`), and the isolated render endpoint (`src/server.ts`).
- **Migration (small)**: one existing prototype case — `packages/ui/src/components/sign-in-flow.case.tsx` (an example) — is migrated to `defineFlow`. Documentation that references prototypes is updated: `packages/display-case/README.md`, `display-case.prompt.md`, `docs/hierarchy.md`, `docs/writing-cases.md`, `skills/display-case-author-case/SKILL.md`, and `packages/ui/README.md`.
- **Consumers**: `apps/web` and `apps/admin` page cases (`src/page-cases/`) gain the construct for authoring behavioural page flows; `defineCases` is unaffected. No production application artifact is affected — Display Case remains development-only.
