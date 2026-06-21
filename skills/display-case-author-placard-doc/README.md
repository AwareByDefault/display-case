# display-case-author-placard-doc

Write a `<component>.placard.md` — the prose doc panel — that lets a reader use the component correctly without opening its source.

## What it does

Reads a component's source for its real props, defaults, and callback contracts (and its case file for variants), then writes a colocated `.placard.md` following the [Writing placard docs](../../docs/writing-placard-docs.md) best practices: an identity line, a copy-pasteable canonical example, variant semantics, the decision boundary to sibling components, the state/callback contract, and composition/a11y notes — and deliberately *omits* anything the source, the manifest, or the component name already says.

## When it triggers

A new shared component is added, a component has a `.case.tsx` but no `.placard.md`, or someone asks to "write a placard doc", "document this component", "add a doc panel", or "write usage docs for `<component>`".

## How it works

1. Read `<name>.tsx` (props, defaults, what callbacks emit) and `<name>.case.tsx` (variants); improve an existing `.placard.md` rather than replace it.
2. Find the decision boundary — the sibling components this one is easily confused with — by scanning the package's component inventory.
3. Draft top-down, highest value first (identity → example → variants → decision boundary → state/callback contract → composition/a11y → gotchas), stopping once the source is unnecessary.
4. Restate meaning, never type signatures; cut prop tables, case/render-URL lists, styling internals, and changelogs.
5. Write for the medium: GFM, no raw HTML, no syntax highlighting, dense.
6. Verify it renders in the doc panel and that every example is correct and copy-pasteable.

Unlike a `.case.tsx`, a `.placard.md` is not enforced by any lint — its only value is quality, so the bar is applied by judgement.

Authoring guide: [`../../docs/writing-placard-docs.md`](../../docs/writing-placard-docs.md). Annotated specimen: [`../../docs/examples/tweak-control.placard.md`](../../docs/examples/tweak-control.placard.md).
