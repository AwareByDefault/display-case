## Why

Display Case browses components one case at a time, which is the right surface for *inspecting* a single specimen but a poor one for *explaining* a design system. There is no place to tell the system's story — its principles, its type and colour decisions, how the pieces fit — with prose set next to the live components it describes. A static README cannot embed live, themed specimens; a per-component documentation panel is scoped to one component and is hidden inside the preview. We want a single long-form "wall text" reading surface — a *placard* — that interleaves authored prose with live specimens drawn from the showcase, so the design system can be read like a museum placard rather than reverse-engineered from the catalog.

## What Changes

- Introduce an optional **authored placard**: a single long-form reading surface that interleaves formatted prose with live component specimens.
- Add a **mode switch** on the browsing surface that toggles between the component catalog and the placard. The switch appears only when a placard is authored.
- Each embedded specimen MAY carry a **title, a subtitle, and a forced theme** that applies to that specimen alone, so a card can demonstrate dark-on-light (or vice versa) regardless of the surface theme.
- The placard's titled sections form a **navigable table of contents** that tracks the section currently in view (scrollspy) and lets a viewer jump to any section.
- The placard has its own **isolated rendering** free of the browsing chrome, so it can be snapshotted like any case.
- When no placard is authored, no switch is offered and the catalog remains the only surface — fully backward compatible.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `display-case`: adds an optional authored placard surface — a prose-plus-live-specimens reading page reachable via a catalog/placard mode switch, with a scrollspy table of contents, per-specimen forced themes, and a chrome-free isolated rendering.

## Impact

- **Spec**: `openspec/specs/display-case/spec.md` — adds "Authored placard".
- **Package** `packages/display-case`: config gains an optional `placard` entry pointing at an authored document (`src/index.ts`); placard codegen and the MDX bundler plugin (`src/discovery.ts`, `src/mdx-plugin.ts`); the placard view, its scrollspy/table-of-contents coordination, and the `Display` specimen contract (`src/ui/placard.tsx`, `src/ui/placard-mount.tsx`); the catalog/manifest marker (`src/manifest.ts`); the isolated `/placard` frame and its mode switch in the browse chrome (`src/server.ts`, `src/ui/shell.tsx`).
- **Dogfooding**: Display Case's own design-system placard (`src/ui/design-system/placard.mdx` and its specimens) demonstrates the surface.
- **Consumers**: existing showcases are unaffected unless they opt in by adding a `placard` to their config. No production application artifact is affected — Display Case remains development-only.
