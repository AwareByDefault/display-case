# Quick start

> Nav: **Quick start** · [Writing cases](writing-cases.md) · [Hierarchy](hierarchy.md) · [Tweaks](tweaks.md) · [Theming](theming.md) · [Documentation panel](documentation-panel.md) · [Writing placard docs](writing-placard-docs.md) · [Testing](testing.md) · [CLI](cli.md) · [AI agents](ai-agents.md) · [Configuration](configuration.md)

Get a component browsing in a few minutes. Everything here runs on Bun — no bundler config, no separate dev server.

## 1. Write a config

Display Case looks for a `display-case.config.ts` at the root of the package it is pointed at. It must default-export `defineConfig(...)`.

```ts
// display-case.config.ts
import { defineConfig } from '@awarebydefault/display-case'

export default defineConfig({
  title: 'Display Case',
  roots: ['src/components/**/*.case.tsx'],
  globalStyles: ['./src/tokens.css', './src/components.css'],
})
```

- `title` shows in the browsing chrome and the manifest.
- `roots` are globs (relative to the package) that locate your case files.
- `globalStyles` are CSS entrypoints injected into every preview, so components render with their real tokens and styles.

Full reference: [Configuration](configuration.md).

## 2. Write a case file

A case file is `*.case.tsx`, colocated with the component it showcases. It default-exports `defineCases(...)`.

```tsx
// src/components/tweak-control.case.tsx
import { defineCases } from '@awarebydefault/display-case'
import { TweakControl } from './tweak-control'

export default defineCases('TweakControl', {
  Variants: () => (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
      <TweakControl kind="text" label="Label" value="Save" />
      <TweakControl kind="choice" label="Variant" options={['default', 'outline']} value="default" />
      <TweakControl kind="boolean" label="Disabled" value={false} />
    </div>
  ),
}, { level: 'atom' })
```

The render functions are lazy thunks — they only run when a case is viewed or screenshotted. Keep the module side-effect-free at the top level; the server imports it to build the manifest without ever calling them.

## 3. Start the server

Point the CLI at the package directory:

```bash
bunx @awarebydefault/display-case .
```

Or wire up an npm script and use that:

```jsonc
// package.json
{ "scripts": { "display-case": "display-case ." } }
```

```bash
bun run display-case
```

The server prints its URL (default `http://localhost:3100`). Open it and you'll see your components grouped by hierarchy level in the sidebar, with each case rendered in an isolated frame.

Change a `*.case.tsx` or `*.placard.md` file and the server rebuilds automatically. There is no in-page hot reload — refresh to pick up the change.

## 4. Next steps

- Add interactive controls: [Tweaks](tweaks.md).
- Group and order components: [Hierarchy](hierarchy.md).
- Document a component inline: [Documentation panel](documentation-panel.md).
- Catch regressions: [Testing](testing.md).
