## Context

Display Case already renders isolated case frames (`/render/...`) and a browse shell with a sidebar and preview area. The placard reuses both ideas: it is another isolated frame (`/placard`) hosted inside the same shell, switched into view by a sidebar control.

## Goals

- A reading surface that mixes authored prose and live specimens, authored as a single document.
- Specimens are real, themeable components — not screenshots.
- Sidebar navigation and scrollspy that match the calm, chrome-light aesthetic of the rest of the tool.
- Zero cost when unused: no placard configured ⇒ no switch, no frame, no behaviour change.

## Decisions

### Authoring format: MDX
The placard is authored as an MDX document referenced by a single config field, `placard?: string` (a path relative to the package), in `src/index.ts`. MDX lets prose and JSX specimens coexist in one file. `@mdx-js/mdx` compiles it through a bundler plugin (`src/mdx-plugin.ts`); `src/discovery.ts` codegens a placard entry module that imports the compiled document and hands it to the placard mount. Rationale: prose-with-components is exactly MDX's domain, and the compile happens in the existing build step so the browser receives a plain module.

### The `Display` specimen contract
The MDX document is given a `Display` component (`src/ui/placard.tsx`) automatically, so authors do not import anything. `Display` accepts `title`, optional `subtitle`, and an optional forced `theme`, and renders its children as a live specimen card. The `title` doubles as both the table-of-contents label and the scroll anchor — one declaration drives navigation and content. A forced-theme specimen re-scopes the design tokens for its subtree (`[data-theme]`), so a single card can show the opposite theme without affecting the surface.

### Mode switch instead of a separate route
The placard is presented as a *mode* of the existing shell rather than a separate page, via a `ModeSwitch` in the sidebar (`src/ui/shell.tsx`) that only renders when `manifest.placard` is set. This keeps theme/viewport controls and the single-window mental model intact; switching modes swaps the sidebar contents (component tree ⇄ placard table of contents) and the framed surface.

### Scrollspy via postMessage
The placard runs in an isolated frame, so the shell cannot read its scroll position directly. The frame reports the active section and accepts scroll-to/theme messages over `postMessage` (`src/ui/placard.tsx`, `src/ui/placard-mount.tsx`), mirroring the existing render-frame message channel. The sidebar table of contents highlights the reported active section.

### Isolated `/placard` frame
Like `/render`, the `/placard` endpoint (`src/server.ts`) serves the placard alone with only the styling needed to display it, so it can be snapshotted chrome-free and themed.

## Risks / Trade-offs

- **MDX adds a compile dependency.** Mitigated: it is already part of the build pipeline and only engaged when a placard is configured.
- **A second framed surface** increases shell complexity. Mitigated by reusing the existing frame/message machinery rather than inventing a parallel one.

## Migration

None. The feature is purely additive and opt-in via the `placard` config field. Showcases without it are unchanged.
