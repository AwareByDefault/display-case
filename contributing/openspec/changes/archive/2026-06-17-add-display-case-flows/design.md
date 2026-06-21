## Context

Display Case authoring lives in `packages/display-case/src/index.ts` and produces `CaseModule` values (`defineCases`, `definePrototype`). The render harness `src/ui/render-mount.tsx` reads the active case/theme/width/tweaks from the URL, renders the matched case (`found.case()` or `found.case.render(values)`) wrapped in the configured decorator, and already supports an in-place update path: a parent→iframe `dc-render` postMessage swaps case/theme/width/tweaks without reloading the iframe. Addresses are slugified component/case ids (`src/catalog.ts`); the manifest (`src/manifest.ts`) lists each component's cases with `browseUrl`/`renderUrl`/`tweaks`; the isolated `/render/<component>/<case>` endpoint (`src/server.ts`) is what the browse iframe embeds and the visual-regression runner screenshots.

The existing `definePrototype` gives ordered, addressable pages but the viewer drives stepping from the chrome; a page cannot itself advance the flow, and pages carry no preset state. The only way to demonstrate an in-page transition today is local React state inside one case — whose later states are not addressable and not reached by the checker.

This change is being made to enable design-first authoring of behavioural page flows for `apps/web` and `apps/admin` page cases (`src/page-cases/`). The decision (below) is to unify on a single top-level construct rather than carry both a static prototype and an interactive flow.

## Goals / Non-Goals

**Goals:**
- Provide a single top-level construct — the interactive flow — whose steps map onto the *existing* case-addressing model, so deep-linking, the isolated render endpoint, and visual-regression coverage apply to every step for free.
- Let an interaction within a rendered step advance the flow to a named step, updating the active step in place via the existing live-update path.
- Let each step pin preset state (reusing the tweak system) so one presentational view serves many steps.
- Keep presentational views pure: the step wires `goto` to the view's callback props; the view never imports navigation.
- Cover the former prototype use case (a static ordered page sequence) as a flow whose steps declare no transitions.

**Non-Goals:**
- Preserving arbitrary in-flight session state across a transition. Steps are reproducible from their address by design (that is what keeps them addressable and snapshottable); only preset state and explicit per-transition overrides survive.
- Transition guards/conditions as a declarative construct (the author expresses branching by choosing which `goto` to call).
- Any change to `defineCases` authoring or to production app artifacts (Display Case stays development-only).

## Decisions

### D1 — A flow step IS a case; only transitions are new
A flow is emitted as a `CaseModule` at the `flow` hierarchy level whose `cases` are its steps, with two additions: a module flag marking it a flow, and per-step `transitions` metadata. This is the load-bearing decision: by representing steps as ordinary addressable cases, discovery, slug addressing, the `/render` endpoint, the manifest, and the visual-regression runner (which already iterates manifest cases and screenshots each) all work on steps with no change. *Alternative rejected:* a parallel "flow" entity with its own addressing/snapshot path — duplicates four subsystems for no gain.

### D2 — `defineFlow` authoring shape
```ts
export default defineFlow('Sign-in', {
  steps: {
    'Request link': {
      render: ({ goto }) => <RequestLinkView onSubmit={() => goto('Check email')} />,
    },
    'Check email': {
      tweaks: { error: tweak.boolean(false) },           // preset/parameter space for the step
      render: ({ values, goto }) => (
        <CheckEmailView
          error={values.error}
          onVerify={() => goto('Verified')}
          onWrongCode={() => goto('Check email', { error: true })}  // re-enter with an override
        />
      ),
    },
    'Verified': { render: () => <VerifiedView /> },
  },
})
```
A step is a superset of the existing `TweakedCase`: optional `tweaks` (defaults are the step's preset state) plus a `render` that receives `{ values, goto }`. `goto(stepName, overrides?)` is injected by the harness. The view stays pure — it only sees props and callbacks. A static sequence (the former prototype) is just steps with no transitions. *Alternative rejected:* a declarative `transitions: { onSubmit: 'Check email' }` map keyed by event name — less flexible than handing the author a `goto` to wire into any callback, and it leaks event-naming assumptions into the construct.

### D3 — `goto` navigates the harness, it does not hold local state
`goto(target, overrides?)` computes the target step's address within the same flow (target step id + optional tweak overrides encoded with the existing tweak encoding), pushes it to `history`, and re-renders through the **same internal `navigate(state)` function** that backs the `dc-render` postMessage path in `render-mount.tsx`. Consequence: the URL always reflects the active step, so a transitioned-to step is immediately deep-linkable and snapshottable (satisfies the "transitioned-to step is addressable" scenario). *Alternative rejected:* `useState` for the current step — this is exactly the hand-rolled approach being replaced; later states would not be addressable or captured.

### D4 — Keep the chrome's step list in sync via an iframe→parent message
The browse shell (`src/ui/shell.tsx`) shows a flow's steps and lets the viewer select any of them. When `goto` fires inside the iframe, the harness posts a `dc-step-changed` message up to the parent so the sidebar highlights the new active step. This extends the existing parent↔iframe protocol by one message; the isolated `/render` endpoint ignores it (no parent), so snapshotting is unaffected.

### D5 — Manifest/catalog carries transitions
Each step entry in the manifest gains `transitions: Array<{ target: <step id> }>`, and the component entry is marked a flow. This satisfies the catalog requirement ("each flow lists its steps with their addresses and each step's outgoing transitions") and lets an agent walk the flow graph without rendering. `transitions` is derived from a lightweight declaration on each step (the set of targets it can `goto`), kept separate from the imperative `goto` calls so the manifest stays static-analysable without executing render functions (consistent with the "import to build the manifest without rendering" invariant in `index.ts`).

### D6 — Presentational-purity convention, documented not enforced
The split (pure view in app code, step wires `goto` to callbacks) is a convention surfaced in the Display Case authoring docs and the app `page-cases/README.md`. No lint enforces it; the example flow case demonstrates it.

### D7 — Remove `definePrototype`; rename the `prototype` level to `flow`
With flows covering the prototype's entire behaviour (ordered, addressable, snapshottable steps) and adding presets + transitions, two constructs at the same hierarchy level would be redundant. `definePrototype` is removed and the top hierarchy level is renamed `prototype` → `flow` so the level name matches the one construct. This is a breaking API change, but the migration surface is a single example case (`packages/ui/src/components/sign-in-flow.case.tsx`) plus documentation. *Alternatives rejected:* (A) keep both constructs independent — leaves a permanent "which do I use?" ambiguity; (B) keep `definePrototype` as sugar over the flow engine — still two entry points and a stale "prototype" term for no real ergonomic saving over `defineFlow` with no transitions.

## Risks / Trade-offs

- **Breaking removal of `definePrototype`** → any out-of-tree case file using it breaks. Mitigation: only one in-repo example uses it; the migration (pages → transition-less steps) is mechanical and documented in the spec's REMOVED migration note.
- **Declared transition set can drift from actual `goto` calls** (D5 needs targets statically but `goto` is imperative) → a step that calls `goto('X')` without declaring `X` still works at runtime but won't appear in the catalog graph. Mitigation: a dev-time warning when a `goto` target isn't in the step's declared transitions; the declaration is the catalog's source of truth.
- **Untyped step names** — `goto('typo')` is not caught at compile time. Mitigation: type `goto` via generics over the step keys where ergonomic; otherwise a runtime not-found step state (already specified). Listed in Open Questions.
- **History/back-button semantics** — pushing per `goto` makes browser-back walk the flow. Acceptable, arguably desirable. Mitigation: `pushState` for explicit transitions; the entry step uses `replaceState` on load.
- **No cross-step session state** — by design (D3/Non-Goals); could surprise authors expecting form values to carry. Mitigation: documented; per-transition `overrides` cover the intended-carry cases.
- **Doc references to "prototype"** scattered across several files → stale terminology if missed. Mitigation: enumerated in the migration plan; grep-verified.

## Migration Plan

Additive to runtime data (none persisted), breaking to the authoring API.
1. Extend the authoring API (`src/index.ts`): add `defineFlow`, the `FlowStep` case kind, transitions metadata; rename the `prototype` hierarchy level to `flow`; remove `definePrototype` and its exports.
2. Extend `render-mount.tsx`: factor the in-place update into one `navigate(state)`; inject `goto`; emit `dc-step-changed`.
3. Extend manifest/catalog (`src/manifest.ts`, `src/catalog.ts`) with transitions + the flow marker.
4. Extend the shell (`src/ui/shell.tsx`) to render flow steps and react to `dc-step-changed`.
5. Migrate `packages/ui/src/components/sign-in-flow.case.tsx` from `definePrototype` to `defineFlow`.
6. Update docs that reference prototypes (README, `display-case.prompt.md`, `docs/hierarchy.md`, `docs/writing-cases.md`, `skills/display-case-author-case/SKILL.md`, `packages/ui/README.md`) and add flow guidance + an example flow case under `apps/web/src/page-cases/`.
7. Rollback = revert the change; nothing persisted.

## Open Questions

- Should `goto` be statically typed over the declared step keys (generics), or is the runtime not-found step sufficient?
- Do we want a tiny `<FlowView>`/helper to standardise the callback-to-`goto` wiring, or leave it as a plain convention (D6)?
