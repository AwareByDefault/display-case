# Examples

> Nav: [Quick start](../quick-start.md) · [Writing cases](../writing-cases.md) · [Hierarchy](../hierarchy.md) · [Tweaks](../tweaks.md) · [Theming](../theming.md) · [Documentation panel](../documentation-panel.md) · [Writing placard docs](../writing-placard-docs.md) · [Testing](../testing.md) · [CLI](../cli.md) · [AI agents](../ai-agents.md) · [Configuration](../configuration.md)

Example files that illustrate the snippets used throughout the guides. Display Case dogfoods itself, so these examples case Display Case's own UI parts — `TweakControl` (an atom) and `FlowNav` (a molecule). They are illustrative: these components aren't actually cased in the package yet, and this folder is **not** type-checked, so the colocated `./tweak-control` / `./flow-nav` imports are imaginary stand-ins.

| File | Shows | Subject | Guide |
| --- | --- | --- | --- |
| [`plain.case.tsx`](plain.case.tsx) | A single named case with a render thunk. | `TweakControl` | [Writing cases](../writing-cases.md) |
| [`tweaks.case.tsx`](tweaks.case.tsx) | A `Playground` case with text, choice, and boolean tweaks. | `TweakControl` | [Tweaks](../tweaks.md) |
| [`multi-variant.case.tsx`](multi-variant.case.tsx) | Several named cases for one component. | `FlowNav` | [Writing cases](../writing-cases.md) |
| [`tweak-control.placard.md`](tweak-control.placard.md) | A component doc panel, annotated section by section. | `TweakControl` | [Writing placard docs](../writing-placard-docs.md) |

To use a `*.case.tsx`, copy it next to a component as `<component>.case.tsx`, point the import at your real component, and make sure your config's `roots` glob matches its location. To use the `.placard.md`, copy everything above its `---` rule to `<component>.placard.md` and rewrite it for your component. See [Quick start](../quick-start.md).
