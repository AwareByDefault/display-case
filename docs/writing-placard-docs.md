# Writing placard docs

> Nav: [Quick start](quick-start.md) · [Writing cases](writing-cases.md) · [Hierarchy](hierarchy.md) · [Tweaks](tweaks.md) · [Theming](theming.md) · [Documentation panel](documentation-panel.md) · **Writing placard docs** · [Testing](testing.md) · [CLI](cli.md) · [AI agents](ai-agents.md) · [Configuration](configuration.md)

A `<component>.placard.md` is the component's **prose contract**: the one place that
tells a reader what the types can't. [Documentation panel](documentation-panel.md)
covers how the file is discovered and rendered; this guide covers what to *put in
it*. For a complete, annotated specimen see
[`examples/tweak-control.placard.md`](examples/tweak-control.placard.md).

## Who reads it, and why that decides everything

The primary reader is an **AI agent** assembling a UI; the secondary reader is a
human skimming the doc panel. Both arrive already holding two things you should
never restate:

- the **source** — every prop name, type, and default is in the `.tsx`;
- the **manifest** — every case, `renderUrl`, and `tweaks` schema is already
  enumerated for machine readers (see [AI agents](ai-agents.md)).

So the placard doc earns its tokens only by carrying what *neither* of those can
express: **intent, judgement, and contract.** A good doc lets a reader choose the
component and use it correctly on the **first try, without opening the source.**
That is the whole bar.

> **The one principle:** document what the types can't. A signature says a prop is
> `(next: string[]) => void`; only prose says whether `next` is *the toggled item*
> or *the full next array*. Spend your words there.

## What to include

Ordered by value. Lead with the highest; stop when a reader could use the
component correctly without the source. Most atoms need only the first three.

1. **Identity line.** A bold name, an em-dash, and one sentence: *what it is* and
   *the single most common reason to reach for it*. This is what shows when the
   library is scanned, so it must stand alone. Lead with the conclusion.

2. **Canonical example.** One minimal, **correct, copy-pasteable** `tsx` snippet
   of the idiomatic call — the common case, not every prop. Agents paste it
   verbatim, so a wrong example is worse than none. Add a second snippet only when
   a distinct mode (a different `kind`, a controlled vs. composed form) genuinely
   needs one.

3. **Variants and when to pick each.** Map each variant/mode to its *meaning and
   use*, not its type union. Name the default. Use a GFM table once there are more
   than three; a sentence suffices below that. Restate semantics, never the
   signature — semantics drift more slowly than types.

4. **Decision boundary — when *not* to use it.** The highest-value, most-skipped
   content. Point to the sibling that fits the case you're excluding, by name, so
   the reader navigates the library instead of misusing this part: *"for long or
   searchable lists, reach for `Combobox`"*; *"inline notice, not a transient
   toast — use `Toast` for those."* This is the single biggest defence against an
   agent picking the wrong primitive.

5. **State & callback contract.** Controlled or uncontrolled? What does each
   callback *emit* — the changed item or the whole next value? What fires on
   mount? None of this is visible in a type and all of it is guessed wrong.

6. **Composition & required wrappers.** Relationships the type system permits but
   the design requires: *"wrap in `FormField` for the label and error"*; *"at most
   one Other choice per question."* Constraints that aren't compile errors.

7. **Accessibility behaviour.** What the component handles for you (so the reader
   doesn't double up a `role`) and what the caller **must** supply (a label, alt
   text). State it in one line; omit if there's nothing non-obvious.

8. **Gotchas & anti-patterns.** The non-obvious rule and the tempting wrong use.
   One bullet each; skip the section if there are none.

## What to leave out

Every line here is either drift waiting to happen or a duplicate of a better
source:

- **Prop tables that retype the TypeScript.** Restate a prop only to add meaning
  the type lacks. The source is the signature of record.
- **The case list, render URLs, or tweak schema.** The manifest owns these and
  stays in sync automatically; a copy here only rots.
- **Styling internals** — CSS variables, class names, DOM structure, token math.
- **Implementation detail** — how it works inside. Document the contract, not the
  mechanism.
- **Changelog or version history.** That is what git is for.
- **Anything the name already says.** `<Spinner>` spins.

## Form: write for the medium

The doc renders as **CommonMark + GFM** (tables, task lists, strikethrough,
autolinks) — but with [two limits](documentation-panel.md#two-intentional-limits):

- **No raw HTML.** Embedded `<div>`/`<span>`/`<style>` is stripped, not rendered.
  Stay in Markdown.
- **No syntax highlighting.** Fenced blocks are plain `<pre>`. Use fences for
  *structure*, never to imply colour.

And because the file is ingested into a context window as often as it is read on a
screen:

- **Be dense.** Every sentence earns its tokens. The model of a great doc is
  short — see [`Button.placard.md`](../src/ui/design-system/components/controls/Button.placard.md):
  identity line, example, one variant sentence. Scale up only for real complexity.
- **Be scannable.** Bold lead line always; `##` headings only once the doc has
  enough distinct sections to need them. A five-line atom needs no headings.
- **Be present-tense and declarative**, in the calm house voice — no marketing,
  no hedging.
- **Keep examples runnable and current.** They are the most-copied lines in the
  file; treat a stale example as a bug.

## Length is a function of complexity, not a target

| Component shape | Doc shape |
| --- | --- |
| Atom, 1–2 props, one behaviour | Identity line + one example + a variant sentence. ~5 lines. |
| Several variants or modes | Add a variant table and a decision-boundary line. |
| Non-obvious callback or composition | Add the state/callback contract and required-wrapper notes. |
| Subtle a11y or footguns | Add an accessibility line and a gotchas bullet. |

Stop at the point where an agent could use the component correctly without the
source. Past that, more words are liability, not value.

## Pages, templates, and flows

Everything above assumes a **reusable component** (atom / molecule / organism) —
something you instantiate, so the doc revolves around the *call*: identity,
canonical example, variants, decision boundary, prop/callback contract.
Template-, page-, and flow-level exhibits aren't parts you instantiate, so that
shape mostly doesn't apply. There is **no idiomatic call to paste, no prop API,
no variant union** — drop the canonical-example snippet, the variant table, and
the state/callback contract. The one principle holds, but what you document turns
**behavioural / structural**, and the [manifest](ai-agents.md) already enumerates
the cases / steps / `renderUrl`s / `transitions` — restate their *meaning*, never
re-list them.

- **Template** (page-level layout, no real data) — document **expected usage**:
  the regions/slots the layout defines and what each is meant to hold, and when to
  reach for this layout over a sibling. Structure, not data, not behaviour.
- **Page** (a template filled with representative content) — document **expected
  behaviour**: what screen it represents, what a viewer can do on it, the states
  it exercises, and which template + content it composes. What it *does*.
- **Flow** (a multi-step journey) — document **expected behaviour end to end**:
  the ordered steps and what each represents, and — critically — *what advances
  the flow between them* (the trigger on each transition), plus entry/exit and any
  preset step state ([Hierarchy](hierarchy.md#flows) explains the flow model).

Skeletons for the three:

````md
<!-- template -->
**Name** — the layout it is; the one reason to reach for it.

Regions: `header` (…) · `main` (…) · `aside` (…) — what each holds.

Use this layout for X; for Y reach for `OtherTemplate`.
````

````md
<!-- page -->
**Name** — the screen it represents; what it demonstrates.

Behaviour: what the viewer can do; the states shown.

Composes `SomeTemplate` with `…` content.
````

````md
<!-- flow -->
**Name** — the journey and its outcome.

Steps, in order: `step-one` (…) → `step-two` (…) → `done` (…).

Advances when: `step-one`'s submit → `step-two`; … . Entry: … . Preset: … .
````

## A skeleton to copy

````md
**ComponentName** — what it is; the one reason to reach for it.

```tsx
<ComponentName prop="idiomatic" onChange={handle} />
```

Variants: `default` (…, the default) · `alt` (…). Restate what each *means*.

Use this for X. For Y, reach for `SiblingComponent` instead.

Controlled — pass `value`/`onChange`; `onChange` emits the exact contract.
Wrap in `FormField` for a label and error. Handles `role=…` itself.
````

Drop any line that would only restate the type or the name. The
[canonical example](examples/tweak-control.placard.md) fills this skeleton in for a
real component, with margin notes on each choice.
