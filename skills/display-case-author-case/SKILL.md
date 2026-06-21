---
name: display-case-author-case
description: >
  Write a Display Case *.case.tsx file for a component that lacks one, so it
  appears in the showcase and passes the display-case-coverage lint. Use when
  the coverage check fails, when adding a new shared component, or when asked to
  "add a case", "showcase this component", or "cover <component> in Display Case".
---

Author a colocated `*.case.tsx` for a component so it shows up in Display Case.

## Steps

1. **Read the component source** (`<name>.tsx`) to get the exact exported name and prop types. Read the sibling `<name>.placard.md` if present for realistic usage.
2. **Create `<name>.case.tsx`** next to it, default-exporting `defineCases`:
   ```tsx
   import { defineCases, tweak } from 'display-case'
   import { TweakControl } from './tweak-control'

   export default defineCases(
     'TweakControl',
     {
       Default: () => <TweakControl kind="text" label="Label" />,
       Variants: () => (/* one instance per meaningful variant */),
       Playground: {
         tweaks: { label: tweak.text('Variant'), disabled: tweak.boolean(false) },
         render: (t) => <TweakControl kind="text" label={t.label} disabled={t.disabled} />,
       },
     },
     { level: 'atom' }, // atom|molecule|organism|template|page
   )
   ```
3. **Pick the hierarchy `level`** by composition: primitives→`atom`, small composites→`molecule`, sections→`organism`, layouts→`template`, full screens→`page`. A behavioural multi-step flow uses `defineFlow(name, { steps, area? })` instead (level `flow`). For a `page`/`flow` case that should render inside app chrome (nav/header), add a free-form `area` tag — `defineCases(name, cases, { level: 'page', area: 'app' })` or `defineFlow(name, { area: 'app', steps })` — which the package's decorator maps to a layout (it overrides folder-based detection via the case's path).
4. **Add tweaks** for the interesting props (`tweak.text/boolean/number/choice`); cast a `choice` value into a union-typed prop.
5. **Keep it side-effect-free**: cases are lazy thunks. For controlled components, define a tiny stateful demo component above the export and reference it.
6. **Verify**: `bun run display-case` shows it; the `display-case-coverage` lint passes.

## Reference

`../../display-case.prompt.md` is the authoring spec; `../../docs/writing-cases.md`, `../../docs/hierarchy.md`, and `../../docs/tweaks.md` go deeper.
