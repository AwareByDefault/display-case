# Writing cases

> Nav: [Quick start](quick-start.md) · **Writing cases** · [Hierarchy](hierarchy.md) · [Tweaks](tweaks.md) · [Theming](theming.md) · [Documentation panel](documentation-panel.md) · [Writing placard docs](writing-placard-docs.md) · [Testing](testing.md) · [CLI](cli.md) · [AI agents](ai-agents.md) · [Configuration](configuration.md)

A case file is the unit of the showcase: a `*.case.tsx` file colocated with the component it demonstrates, default-exporting one call to `defineCases` or `defineFlow`.

```tsx
// src/components/tweak-control.case.tsx
import { defineCases } from 'display-case'
import { TweakControl } from './tweak-control'

export default defineCases('TweakControl', {
  Kinds: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <TweakControl kind="text" label="Label" value="Save" />
      <TweakControl kind="boolean" label="Disabled" value={false} />
      <TweakControl kind="choice" label="Variant" options={['sm', 'md', 'lg']} value="md" />
    </div>
  ),
  Boolean: () => <TweakControl kind="boolean" label="Disabled" value={true} />,
  Disabled: () => <TweakControl kind="text" label="Label" value="Save" disabled />,
}, { level: 'atom' })
```

## `defineCases(component, cases, meta?)`

| Argument | Type | Notes |
| --- | --- | --- |
| `component` | `string` | The display name shown in the sidebar. Its slug (kebab-case) forms the URL, e.g. `TweakControl` → `/c/tweak-control`. |
| `cases` | `Record<string, Case>` | Keyed by display name; **insertion order is preserved**. Each value is either a simple render thunk or a tweaked case (see below). |
| `meta.level` | `HierarchyLevel?` | One of `atom`, `molecule`, `organism`, `template`, `page` (`flow` is set automatically by `defineFlow`). Drives sidebar grouping. Omit to leave it "unclassified" (sorted last). See [Hierarchy](hierarchy.md). |
| `meta.area` | `string?` | Free-form layout tag passed to the [`decorator`](configuration.md#decorator) so it can wrap this case in app chrome (nav/header/footer). Display Case mandates no vocabulary — the decorator interprets the value. Takes precedence over folder-based detection via `sourcePath`; omit to fall back to that (or to render bare). |

### Two shapes of case

A **simple case** is a thunk returning a React node:

```tsx
Disabled: () => <TweakControl kind="text" label="Label" value="Save" disabled />,
```

A **tweaked case** declares typed controls and receives their resolved values:

```tsx
Playground: {
  tweaks: { label: tweak.text('Save') },
  render: (t) => <TweakControl kind="text" label="Label" value={t.label} />,
},
```

See [Tweaks](tweaks.md) for the full control set.

### Order the default-landing variant first

Clicking a component in the sidebar navigates to its **first** case, so lead with the most exploratory variant — a tweaked `Playground` case, or a "do-anything" interactive demo (e.g. a stateful, clickable example). Keep isolated single-state variants (one `Disabled`, one `With error`) *after* it: those exist mainly for snapshots and visual-regression, not as the thing a reader should land on. Flow steps are the exception — order them in flow sequence (`defineFlow` below).

## `defineFlow(name, { steps })`

For behavioural multi-step flows — a wizard, a sign-in sequence — use `defineFlow`. Each step is an ordered, individually addressable, snapshottable state. A step may declare preset `tweaks`, `transitions` to other steps, and wire its injected `goto` into a presentational view's callbacks so an in-step button advances the flow in place.

```tsx
// src/components/sign-in-flow.case.tsx
import { defineFlow } from 'display-case'
import { RequestLink, CheckEmail, SignedIn } from './sign-in-screens'

export default defineFlow('Sign-in flow', {
  steps: {
    'Request link': {
      transitions: ['Check email'],
      render: ({ goto }) => <RequestLink onSubmit={() => goto('Check email')} />,
    },
    'Check email': {
      transitions: ['Signed in'],
      render: ({ goto }) => <CheckEmail onOpen={() => goto('Signed in')} />,
    },
    'Signed in': { render: () => <SignedIn /> },
  },
})
```

Keep the views pure: a step wires `goto` to the view's callbacks; the view never imports navigation, so the same view is reused in the real route. `goto(step, overrides?)` re-enters the target step with optional preset tweak values. A flow whose steps declare no transitions is a static, walkable sequence. A flow is always at the `flow` level. See [Hierarchy](hierarchy.md#flows) for how flows differ from regular cases.

`defineFlow` also accepts an optional `area` alongside `steps` — the same free-form layout tag as [`meta.area`](#definecasescomponent-cases-meta) — so a flow can be wrapped in app chrome by the decorator:

```tsx
export default defineFlow('Checkout', { area: 'app', steps: { /* … */ } })
```

**Typed step values.** A bare step object has loosely-typed `values`. To read typed preset values (`values.error` as `boolean`), wrap the step in the `flowStep` helper, which infers the step's own tweak schema:

```tsx
import { defineFlow, flowStep, tweak } from 'display-case'

export default defineFlow('Sign-in', {
  steps: {
    'Check email': flowStep({
      tweaks: { error: tweak.boolean(false) },
      render: ({ values, goto }) => (
        <CheckEmail error={values.error} onVerify={() => goto('Signed in')} />
      ),
    }),
    'Signed in': { render: () => <SignedIn /> },
  },
})
```

`goto`/`transitions` targets are not key-checked at compile time — an unknown target renders the not-found step at runtime.

## Authoring rules

- **Default-export the definition.** A file with no valid default export (or one whose `component` is not a string) is skipped and reported as a load error; the rest still load.
- **No top-level side effects.** Render functions are lazy. The server imports the module to build the manifest without rendering — so don't call hooks, fetch, or touch the DOM at module top level.
- **Give an interactive specimen a distinct per-case `key`.** This is a foot-gun worth understanding. A controlled component needs a little wrapper that owns its state (`function Demo({ initial }) { const [v, setV] = useState(initial); … }`), and you'll reuse that one wrapper across several cases. But the browse chrome **swaps cases in place** — it re-renders one persistent root with `root.render()` and never unmounts (so theme/tweak changes don't flicker). React then sees the *same* `<Demo>` at the *same* position across cases and **keeps its `useState` value** instead of re-seeding from the new case's `initial`. Between cases whose props differ — a different selected id, or a disjoint set of options — the leaked value shows the wrong selection, or (if it isn't in the new options) *no* selection at all. Fix it by giving each case's wrapper a distinct `key` so React remounts it:

  ```tsx
  function Demo({ options, initial }: { options: Opt[]; initial: string }) {
    const [value, setValue] = useState(initial)
    return <Toggle options={options} value={value} onChange={setValue} />
  }

  export default defineCases('Toggle', {
    // A bare <Demo …/> here would carry the previous case's value across the swap.
    Two:  () => <Demo key="two"  options={two}  initial="b" />,
    Five: () => <Demo key="five" options={five} initial="lg" />,
  })
  ```

  A tweaked `Playground` that re-seeds from a tweak follows the same rule — key it by the seeding tweak (`key={`pg-${t.count}`}`) so changing the tweak remounts with the new `initial`. A specimen rendered in only *one* case is safe (switching to any sibling case mounts a different element, which remounts it anyway). The `interactive-cases-keyed` structure check flags a stateful wrapper reused across cases with a missing `key`; waive a deliberate exception with a `// display-case: allow-interactive-cases-keyed <reason>` comment.
- **Compose freely inside a render.** Layout wrappers, multiple instances, sample data — anything that returns a React node is fine.
- **One component (or flow) per file.** Coverage tooling expects a `<name>.case.tsx` sibling for each component module.
- **Edits are picked up on save; reload to see them.** The dev server watches case files and rebuilds on every change — including manifest-shape edits (case *order*, case/component *names*, hierarchy `level`, tweak schema). There is no in-page HMR, so reload the browser to pick up a rebuild. (The rebuild reads the manifest in a fresh subprocess because Bun caches ES modules by path for a process's lifetime; without that, an in-process re-import would return the stale module.)

## Coverage

The coverage check fails if a showcased component module has no colocated `*.case.tsx`. Wire it into your lint or CI step to keep every component browsable. To exempt a non-showcasable module, add a comment anywhere in the component file:

```tsx
// display-case: no-case this is an internal helper, not a visual component
```

## See also

- Runnable examples: [examples/](examples/) — a plain case, a tweaks case, and a multi-variant case.
- [Configuration](configuration.md) for `roots` globs that decide which files are discovered.
