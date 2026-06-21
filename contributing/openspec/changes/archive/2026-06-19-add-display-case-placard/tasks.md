## 1. Authoring & config

- [x] 1.1 Add an optional `placard?: string` field to the config type in `src/index.ts` (a path to the authored document, relative to the package).
- [x] 1.2 Codegen a placard entry module in `src/discovery.ts` that imports the compiled document and hands it to the placard mount; wire the MDX bundler plugin (`src/mdx-plugin.ts`) so the document compiles in the existing build step.

## 2. Placard surface & specimen contract

- [x] 2.1 Implement the placard view (`src/ui/placard.tsx`, `src/ui/placard-mount.tsx`): render compiled prose as formatted text with live specimens.
- [x] 2.2 Provide the `Display` specimen contract (`title`, optional `subtitle`, optional forced `theme`) automatically to the document, so authors import nothing.
- [x] 2.3 Make a forced-theme specimen re-scope the design tokens for its own subtree so it renders under its theme regardless of the surface theme.

## 3. Navigation & shell integration

- [x] 3.1 Build the table of contents from specimen titles; track the section in view via scrollspy and report it to the shell over `postMessage`; accept scroll-to/theme messages back.
- [x] 3.2 Add the catalog/placard `ModeSwitch` to the sidebar (`src/ui/shell.tsx`), shown only when a placard is configured; swap the sidebar contents and framed surface on switch.

## 4. Isolated render & catalog

- [x] 4.1 Serve the isolated `/placard` frame chrome-free and theme-aware (`src/server.ts`), like `/render`.
- [x] 4.2 Expose the placard's presence in the manifest (`src/manifest.ts`) so the shell knows whether to offer the switch.

## 5. Dogfooding & verification

- [x] 5.1 Author Display Case's own design-system placard (`src/ui/design-system/placard.mdx` + specimens) to demonstrate the surface.
- [x] 5.2 Verify switching to and from the placard, table-of-contents jump + scrollspy, a forced-theme specimen under the opposite surface theme, and that no switch appears when no placard is configured.
- [x] 5.3 Verify the placard renders correctly in dark mode (colours and forced-theme specimens).

## 6. Docs

- [x] 6.1 Document the placard surface and the `Display` contract in `packages/display-case/README.md` and the authoring docs.
