<!--
  Example: a component placard doc.

  This is the canonical specimen referenced by ../writing-placard-docs.md. The
  part above the `---` is the doc as it would ship next to a component — clean and
  copy-pasteable. The annotations below the rule explain why each block is there;
  a real `<component>.placard.md` stops at the rule and keeps none of them.

  Subject: `TweakControl`, Display Case's own atom — a single typed tweak input.
  Display Case dogfoods itself, so its UI parts make good specimens. (Like the
  sibling `*.case.tsx` examples, the component here is an illustrative stand-in.)
-->

**TweakControl** — one typed tweak input, the row a [`TweaksPanel`](../tweaks.md)
is built from; reach for it to render a single live control for one tweak value.

```tsx
<TweakControl kind="text" label="Label" value={label} onChange={setLabel} />
```

A `choice` renders a segmented selector; a `boolean` renders a switch:

```tsx
<TweakControl
  kind="choice"
  label="Variant"
  value={variant}
  options={['ghost', 'primary', 'accent']}
  onChange={setVariant}
/>
<TweakControl kind="boolean" label="Disabled" value={disabled} onChange={setDisabled} />
```

| `kind`    | Renders          | Use for                                  |
| --------- | ---------------- | ---------------------------------------- |
| `text`    | a line input     | free-form strings (the default)          |
| `number`  | a numeric input  | integers and decimals; emits a `number`  |
| `boolean` | a switch         | on/off toggles                           |
| `choice`  | a segmented row  | one value from a short, fixed `options` list |

Use this for a **single** control. To render a whole panel from a case's `tweaks`
schema, use [`TweaksPanel`](../tweaks.md) — it lays out one `TweakControl` per
tweak and handles URL encoding. Don't build a panel by hand out of these.

Controlled only — always pass `value` and `onChange`. `onChange` emits the new
*value* (already typed to the `kind`: a `string` for `text`/`choice`, a `number`
for `number`, a `boolean` for `boolean`), never an event. `choice` requires
`options`; the other kinds ignore it. `label` is the visible, required control
label — there is no separate `id`/`htmlFor` to wire.

---

## Why this doc is shaped this way

Each block maps to a section of [Writing placard docs](../writing-placard-docs.md).
Read it alongside that guide.

- **Identity line.** Bold name, em-dash, one sentence of *what it is* + the *one
  reason to reach for it*. It stands alone in a library scan, and it links the
  sibling (`TweaksPanel`) a reader will want next.
- **Canonical example first.** The single most common call — `text`, controlled —
  before anything else, so it can be copied without reading further. The second
  block is added *only* because `choice`/`boolean` render and are called
  differently enough to guess wrong.
- **Variant table over a type union.** Four kinds crosses the "use a table"
  threshold. Each row gives *meaning and use*, not the TypeScript — and notes the
  default (`text`) and the one non-obvious return type (`number`). It does **not**
  restate the `kind` union; the source already has that.
- **Decision boundary.** The "use this for one control; for a panel use
  `TweaksPanel`" line is the highest-value sentence here: it stops an agent
  hand-rolling a panel out of atoms. It names the sibling instead of just saying
  "don't."
- **State & callback contract.** "Controlled only" and *what `onChange` emits*
  (the typed value, not an event) are invisible in a signature and guessed wrong
  constantly — so they get explicit prose. The `options`-required-for-`choice`
  rule is a constraint the type may not force.
- **What's deliberately absent.** No prop table retyping the source, no list of
  the component's cases or `renderUrl`s (the manifest owns those), no styling or
  DOM internals, no changelog. The doc stops once an agent could use the component
  correctly without opening the `.tsx`.
