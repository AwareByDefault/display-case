# Tweaks

> Nav: [Quick start](quick-start.md) · [Writing cases](writing-cases.md) · [Hierarchy](hierarchy.md) · **Tweaks** · [Theming](theming.md) · [Documentation panel](documentation-panel.md) · [Writing placard docs](writing-placard-docs.md) · [Testing](testing.md) · [CLI](cli.md) · [AI agents](ai-agents.md) · [Configuration](configuration.md)

Tweaks are typed, interactive controls attached to a case. Instead of writing one variant per prop combination, declare the props as tweaks and let the viewer adjust them live.

```tsx
import { defineCases, tweak } from '@awarebydefault/display-case'
import { TweakControl } from './tweak-control'

export default defineCases('TweakControl', {
  Playground: {
    tweaks: {
      label: tweak.text('Save changes'),
      kind: tweak.choice(['text', 'boolean', 'choice'], 'text'),
      disabled: tweak.boolean(false),
    },
    render: (t) => (
      <TweakControl
        kind={t.kind as 'text' | 'boolean' | 'choice'}
        label={t.label}
        disabled={t.disabled}
      />
    ),
  },
}, { level: 'atom' })
```

A tweaked case is an object with two keys: a `tweaks` schema and a `render` function that receives the resolved values.

## Control kinds

There are four serializable tweak builders, all imported from the `tweak` namespace:

| Builder | Resolved value type | Default argument |
| --- | --- | --- |
| `tweak.text(default?)` | `string` | optional, defaults to `''` |
| `tweak.boolean(default?)` | `boolean` | optional, defaults to `false` |
| `tweak.number(default?)` | `number` | optional, defaults to `0` |
| `tweak.choice(options, default)` | `string` | both required |

```ts
tweak.text('Hello')                         // text field
tweak.boolean(true)                          // toggle
tweak.number(8)                              // number field
tweak.choice(['sm', 'md', 'lg'], 'md')       // select from fixed options
```

The keys of the `tweaks` object become the control labels and the property names on the `render` argument.

## Values are URL-encoded

A tweak's current value is serialized into the render URL as `t.<name>`, so any tweaked state is a shareable, snapshottable link:

```
/render/tweak-control/playground?theme=dark&t.label=Delete&t.kind=choice&t.disabled=1
```

Encoding rules:

- `boolean` — `1` / `true` is true; anything else is false.
- `number` — parsed with `Number(...)`.
- `text` and `choice` — used verbatim.
- A missing `t.<name>` falls back to the declared `default`.

This is what lets an AI agent or screenshot tool reproduce an exact tweaked state deterministically — see [AI agents](ai-agents.md).

## Typing

`choice` returns a plain `string` at runtime, so when feeding it back into a union-typed prop you may need a cast (as in the example above). The other kinds resolve to their natural types (`string`, `boolean`, `number`).

## When to reach for tweaks

- **Use a tweaked case** for an exploratory "playground" where many prop combinations matter.
- **Use plain cases** for the canonical, named variants you want to keep visible and snapshot in tests — these render with fixed inputs and are the stable surface for visual regression. See [Testing](testing.md).
