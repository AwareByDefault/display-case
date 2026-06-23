# Hierarchy

> Nav: [Quick start](quick-start.md) · [Writing cases](writing-cases.md) · **Hierarchy** · [Tweaks](tweaks.md) · [Theming](theming.md) · [Documentation panel](documentation-panel.md) · [Writing placard docs](writing-placard-docs.md) · [Testing](testing.md) · [CLI](cli.md) · [AI agents](ai-agents.md) · [Configuration](configuration.md)

Each component declares where it sits in an Atomic Design hierarchy. The level drives how the sidebar groups and orders components, so the showcase reads from smallest building block to largest assembled flow. The first five levels mirror Brad Frost's [five stages of atomic design](https://atomicdesign.bradfrost.com/chapter-2/); `flow` is a Display Case addition for walkable multi-step journeys.

```tsx
export default defineCases('TweakControl', { /* … */ }, { level: 'atom' })
export default defineCases('FlowNav', { /* … */ }, { level: 'molecule' })
export default defineCases('TweaksPanel', { /* … */ }, { level: 'organism' })
```

## The levels

Levels are ordered by increasing composition. The descriptions below follow the [five stages of atomic design](https://atomicdesign.bradfrost.com/chapter-2/):

| Level | Meaning | Example |
| --- | --- | --- |
| `atom` | A foundational building block — the smallest primitive that can't be broken down without losing meaning | TweakControl (a single tweak input) |
| `molecule` | A relatively simple group of atoms functioning together as a unit | FlowNav (a flow stepper) |
| `organism` | A relatively complex section composed of groups of molecules and/or atoms | TweaksPanel, Sidebar |
| `template` | A page-level layout that places components into a structure, with no real data | The Shell browse chrome, empty |
| `page` | A specific instance of a template shown with representative content | The Shell with a component selected |
| `flow` | A multi-step behavioural journey (Display Case's own level, beyond atomic design) | A sign-in sequence |

The internal order is fixed as `atom, molecule, organism, template, page, flow`. Components are sorted by level (atoms first), then alphabetically by name. A component with **no** declared level is treated as "unclassified" and sorts after everything else.

## Components and Exhibits

The level classifies *every* component, but it only *groups the sidebar* for the
building-block kit. The catalog is browsed in two modes (a third, **Primer**,
appears when one is configured):

- **Components** — the kit (`atom` through `template`, plus unclassified),
  grouped by level exactly as above. The reusable parts.
- **Exhibits** — the application's **surfaces** (`page` and `flow`), grouped not
  by level but by their **information-architecture group**: a nestable path that
  mirrors the app's own feature/route structure (e.g. `App / Settings /
  Billing`). This scales where a single flat "Pages" list would not. Within a
  group, a **flow** is distinguished from a page by a high-vis `flow` tag (or a
  leading glyph — see [`nav.flowMarker`](configuration.md#nav)) and numbered step
  rows; pages render plain.

The mode switch shows only the modes that have content, so a pure design-system
package shows just Components and a surfaces-only package shows just Exhibits.
Each mode deep-links by its case-path prefix: `/c/<component>/<case>` for a
Components case, `/e/<component>/<case>` for an Exhibits case.

A surface's group comes from the first of: an explicit
[`meta.group`](writing-cases.md#definecasescomponent-cases-meta) → the case
file's folder (on by default) → showcase [`nav`](configuration.md#nav) config → a
default group. `level` is unchanged and still drives the structure checks; the IA
`group` is a second, independent axis.

## Flows

A flow is a multi-step behavioural journey rather than a set of independent variants. Author it with `defineFlow` — it is always placed at the `flow` level, and you do not pass a `level` yourself.

```tsx
import { defineFlow } from '@awarebydefault/display-case'

export default defineFlow('Sign-in flow', {
  steps: {
    'Request link': {
      transitions: ['Check email'],
      render: ({ goto }) => <RequestLink onSubmit={() => goto('Check email')} />,
    },
    'Check email': { render: () => <CheckEmail /> },
    'Signed in': { render: () => <SignedIn /> },
  },
})
```

How a flow differs from a regular component:

- **Ordered steps, not variants.** The `steps` keep their declared order and represent states of one journey.
- **Per-step addresses.** Each step is individually addressable and snapshottable — `/c/sign-in-flow/request-link`, `/c/sign-in-flow/check-email`, and so on. The manifest marks the component with `isFlow: true` and lists the steps as its `cases`, each with its outgoing `transitions`.
- **In-step transitions.** A step's `render` receives a `goto` that advances the flow in place; wire it into a view's callbacks. `goto(step, overrides?)` re-enters the target step with optional preset tweak values.
- **Preset state.** A step may declare `tweaks`; their defaults are the step's preset state, so one view serves several steps. A flow with no transitions is a static, walkable sequence.

This lets you walk a flow step by step in the browser, click through it via in-step buttons, deep-link to any single step, or screenshot just one state of the journey.

## See also

- [Writing cases](writing-cases.md) for the authoring API.
- [AI agents](ai-agents.md) for how `level` and `isFlow` appear in the manifest.
