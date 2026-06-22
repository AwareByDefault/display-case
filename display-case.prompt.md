**Display Case** — a Bun-native component showcase. This file is the authoring reference for writing **case files**; see [`docs/`](docs/) for the full guides and [`docs/ai-agents.md`](docs/ai-agents.md) for driving the tool as an agent.

## Writing a case file

A case file is colocated next to its component: `tweak-control.tsx` → `tweak-control.case.tsx`. It **default-exports** `defineCases(...)`. Every showcased component must have one (the `display-case-coverage` lint enforces it).

```tsx
import { defineCases, tweak } from '@awarebydefault/display-case'
import { TweakControl } from './tweak-control'

export default defineCases(
  'TweakControl',                            // display name
  {
    Variants: () => (                        // a case = name → () => ReactNode
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <TweakControl kind="text" label="Label" />
        <TweakControl kind="boolean" label="Disabled" />
      </div>
    ),
    Playground: {                            // a case with interactive tweaks
      tweaks: {
        label: tweak.text('Variant'),
        kind: tweak.choice(['text', 'boolean', 'number', 'choice'], 'choice'),
        disabled: tweak.boolean(false),
      },
      render: (t) => (
        <TweakControl
          kind={t.kind as 'text' | 'boolean' | 'number' | 'choice'}
          label={t.label}
          disabled={t.disabled}
        />
      ),
    },
  },
  { level: 'atom' },                         // Atomic Design level (see below)
)
```

## Rules & conventions

- **No side effects at module top level.** Cases are lazy thunks — the render function must not run at import time. The dev server imports every case module to build the manifest *without* calling render, so a top-level effect (DOM access, network, etc.) would break it. Need state? Define a small component above the export and reference it: `Controlled: () => <MyDemo />`. **If you reuse that stateful wrapper across ≥2 cases, give each a distinct `key`** (`Two: () => <MyDemo key="two" …/>`) — the browse chrome swaps cases *in place* without unmounting, so an unkeyed wrapper keeps the previous case's state on switch (the `interactive-cases-keyed` structure check enforces this; full explanation in [docs/writing-cases.md](docs/writing-cases.md#authoring-rules)).
- **Tweaks** are typed controls: `tweak.text(default)`, `tweak.boolean(default)`, `tweak.number(default)`, `tweak.choice(options, default)`. Values are serializable and URL-encoded (`?t.<name>=`), so a tweaked state is shareable and snapshottable. Cast a `choice` value when passing it into a union-typed prop.
- **Hierarchy `level`** (third arg `{ level }`) groups the component in the sidebar, ordered: `atom → molecule → organism → template → page → flow`. Omit it and the component lands in an "Unclassified" group.
- **App chrome `area`** (third arg `{ area }`; also `defineFlow(name, { area, steps })`) is a free-form tag the package's `decorator` can use to wrap a `page`/`flow` case in app layout/nav. The decorator interprets it (Display Case mandates no values); it overrides folder-based detection via `sourcePath`. Omit to render bare.
- **Flows** showcase an interactive multi-step flow. Use `defineFlow('Sign-in flow', { steps: { 'Request link': { transitions: ['Check email'], render: ({ goto }) => <…/> }, … } })`; each step is ordered, individually addressable, and may advance the flow in place via the injected `goto`. Keep views pure — wire `goto` into the view's callbacks.
- **First case = default landing variant.** Insertion order is preserved, and clicking a component in the sidebar opens its first case. Lead with the most exploratory variant (a tweaked `Playground`, or a stateful "do-anything" demo); keep isolated single-state variants (`Disabled`, `With error`) after it — those are mainly for snapshots/visual-regression. Flow steps are ordered in flow sequence instead.
- **Edits are picked up on save; reload to see them.** The server watches case files and rebuilds on every change, manifest-shape included (order, names, `level`, tweak schema). No in-page HMR — reload the browser after an edit. (Rebuilds read the manifest in a fresh subprocess to dodge Bun's per-process module cache.)
- **Exhibits are centered by default.** Decorated components (`atom`…`template` — not `page`/`flow`) have their content centered in the frame: when a case's root flex/grid wraps or is narrower than the frame, its rows sit centered rather than top-left. This is a stylesheet default (`justify-content`/`align-content: center`), so an inline `style={{ justifyContent: 'flex-start' }}` on the case's root still wins if you need left alignment.
- **Naming**: display names and case names are sentence case ("With error", "Playground"). Slugs are derived automatically.
- **Docs panel**: a sibling `<component>.placard.md` is rendered in the preview as CommonMark + GFM.

## Config

The consuming package has a `display-case.config.ts` (`defineConfig({ title, roots, globalStyles, decorator?, baselineDir?, tokens?, providers? })`) — `roots` are the globs that locate `*.case.tsx` files. Launch with `bun run display-case`; check accessibility + visual regression + tokens with `bun run display-case:check`.

## Driving the tool (for agents)

The enumerate → snapshot → verify loop:

1. **Enumerate** — `bun run display-case -- --print-manifest` (no server/browser needed) lists every component, case, hierarchy level, tweak schema, and the `caseFile`/`placardDoc` paths.
2. **Snapshot** — with the server up (`bun run display-case`, port 3100), open `/render/<component>/<case>?theme=light|dark&t.<tweak>=<value>` — a chrome-free HTML document; rasterize it with a headless browser. Same URL → same render.
3. **Verify** — `bun run display-case:check` runs a11y + visual + token checks (exit non-zero on failure).

Full reference: [docs/ai-agents.md](docs/ai-agents.md).
