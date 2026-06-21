---
name: display-case-author-placard-doc
description: >
  Write or improve a component's `<name>.placard.md` — the prose doc panel that
  tells an AI agent (and a human) how to use the component correctly on the first
  try. Use when adding a new shared component, when a component has a `.case.tsx`
  but no `.placard.md`, or when asked to "write a placard doc", "document this
  component", "add a doc panel", or "write usage docs for <component>".
---

Author a colocated `<name>.placard.md` for a component, following
`../../docs/writing-placard-docs.md`. The doc is **not** required by any lint
(only `.case.tsx` is) — its whole value is quality, so apply the bar deliberately.

## The one principle

The reader already holds the **source** (every prop, type, default) and the
**manifest** (every case, `renderUrl`, tweak schema). The doc earns its place only
by carrying what neither can express: **intent, judgement, and contract.** Aim for
a doc that lets a reader pick the component and use it correctly **without opening
the source.** Restate *meaning*, never the type signature.

## Steps

1. **Gather intent, not just signatures.** Read `<name>.tsx` for the exact export
   name, props, defaults, and — critically — *what each callback emits* (the
   changed item vs. the whole next value: invisible in the type, guessed wrong).
   Read `<name>.case.tsx` for the real variants, and any existing `.placard.md` to
   improve rather than replace.
2. **Find the decision boundary.** Scan the package's component inventory (its
   `README.md` / sibling components) for the parts this one is easily confused
   with — the long-list vs. short-list control, the inline notice vs. the toast.
   You will name the right sibling so a reader doesn't misuse this one.
3. **Draft top-down, highest value first** (stop once the source is unnecessary):
   - **Identity line** — bold name, em-dash, one sentence: what it is + the single
     most common reason to reach for it. Must stand alone in a library scan.
   - **Canonical example** — one minimal, **correct, copy-pasteable** `tsx` snippet
     of the idiomatic call. A second snippet only for a genuinely different mode.
   - **Variants and when to pick each** — meaning and use, not the type union; name
     the default; a GFM table once there are more than three.
   - **Decision boundary** — "use this for X; for Y reach for `Sibling`." The
     single biggest defense against picking the wrong primitive.
   - **State & callback contract** — controlled vs. uncontrolled; exactly what each
     callback emits; what fires on mount.
   - **Composition & a11y** — required wrappers (`FormField`…), what the component
     handles itself (so the reader doesn't double up a `role`), what the caller
     must supply (a label, alt text).
   - **Gotchas / anti-patterns** — one bullet each; skip if none.
4. **Cut what rots or duplicates:** no prop tables retyping TypeScript, no list of
   the component's cases / `renderUrl`s / tweak schema (the manifest owns those),
   no styling internals, no changelog, nothing the name already says.
5. **Write for the medium.** CommonMark + GFM, but **no raw HTML** (stripped) and
   **no syntax highlighting** (use fences for structure only). Be dense — the file
   is ingested into a context window; every line earns its tokens. Bold lead line
   always; `##` headings only once the doc has enough sections to need them. A
   simple atom is ~5 lines (see `../../../ui/src/components/button.placard.md`).
6. **Verify.** Open the doc panel (`bun run display-case`) to confirm it renders,
   and re-check that every example is correct and copy-pasteable — a stale example
   is a bug, since those lines get pasted verbatim.

## Reference

Full guide: [`../../docs/writing-placard-docs.md`](../../docs/writing-placard-docs.md).
Annotated specimen: [`../../docs/examples/tweak-control.placard.md`](../../docs/examples/tweak-control.placard.md).
How the panel renders (GFM, the two limits): [`../../docs/documentation-panel.md`](../../docs/documentation-panel.md).
