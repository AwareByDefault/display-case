## 1. Scaffold the package

- [x] 1.1 Create `packages/display-case/` with `package.json` (`@awarebydefault/display-case`, private, type module, React 19 peer dep; deps `react-markdown` + `remark-gfm`; Playwright + axe-core dev deps), `tsconfig.json` matching repo conventions, and add it to the root workspace (covered by `packages/*`).
- [x] 1.2 Add the authoring runtime: `defineCases(componentName, cases, meta?)` (meta carries `level`), `definePrototype(name, { pages })`, `defineConfig(config)` (incl. optional `baselineDir`, default `.display-case/baselines`, resolved relative to the consumer package), and `tweak` helpers (`tweak.text`, `tweak.boolean`, `tweak.number`, `tweak.choice`) with exported types (`CaseModule`, `DisplayCaseConfig`, `TweakSchema`, `HierarchyLevel`); export from `src/index.ts`.
- [x] 1.3 Add a tool-level `.prompt.md` describing the case-file convention, tweaks, and the "no side effects at module top level" rule.

## 2. Discovery and codegen

- [x] 2.1 Resolve the consumer config from a package-path argument; resolve `roots` globs with `Bun.Glob`.
- [x] 2.2 Codegen `browser-entry.tsx` and `render-entry.tsx` into a gitignored `.display-case/` cache dir, importing every discovered case module plus the config's `globalStyles` and optional `decorator`.
- [x] 2.3 Report malformed/unloadable case files by file path without aborting the rest (spec: malformed case file).
- [x] 2.4 Watch the glob and regenerate entries when case files are added or removed.

## 3. Dev server and machine endpoints

- [x] 3.1 Serve the browsing shell and isolated render via the HTML-import `Bun.serve` pattern (bundling + HMR), with path routing `/c/<component>/<case>` and `/render/<component>/<case>`.
- [x] 3.2 Implement `GET /manifest.json` as a directory of file references: import the codegen registry server-side (render fns uncalled); per component include `caseFile` + `promptDoc` paths; per case include `browseUrl`, `renderUrl`, `tweaks` schema, and `baseline` path — no inlined file contents.
- [x] 3.3 Implement `GET /render/<component>/<case>?theme=light|dark&width=<px>` plus tweak params (`?t.<name>=...`); chrome-free, sets `data-theme` from `theme` (default light), applies parsed tweak values.
- [x] 3.4 Implement the `--print-manifest` CLI flag (print manifest JSON to stdout and exit).
- [x] 3.5 Derive stable kebab-case slugs from component + case names (and prototype page names); return a not-found state for unknown component/case/page routes.

## 4. Browsing UI

- [x] 4.1 Build the shell: component sidebar grouped by hierarchy level (atom→…→prototype, then Unclassified) with components under each, case selector, and a preview pane embedding `/render/...` in an iframe.
- [x] 4.2 Add theme toggle (light/dark) and viewport-width control; both drive the iframe without reloading the catalog.
- [x] 4.3 Add the tweaks controls panel: render a control per declared tweak, push changes to the iframe URL, and encode values in the case address (reproduced on reload).
- [x] 4.4 Add the show/hide documentation panel rendering the component's `.prompt.md` via `react-markdown` + `remark-gfm` (full CommonMark + GFM; raw HTML disabled; fenced code as styled `<pre><code>`). Panel omitted when no doc exists; lives outside the render iframe.
- [x] 4.5 Add prototype flow navigation: a step rail + prev/next that switches the iframe between the prototype's ordered pages, each page deep-linkable and reflected in the address.
- [x] 4.6 Add a calm empty state when no cases are discovered.

## 5. A11y and visual-regression runners

- [x] 5.1 Add a `check` CLI that boots the server, enumerates cases from the manifest, and drives Playwright over each case's `/render` URL per theme.
- [x] 5.2 A11y: inject axe-core, collect violations per case/theme, report (case, theme, rule, node), exit non-zero on any violation.
- [x] 5.3 Visual regression: screenshot each case/theme after fonts ready + animations disabled at a pinned viewport; pixel-diff against recorded baselines under the configured `baselineDir` (default `.display-case/baselines/`, gitignored); `--update` records/refreshes baselines; default compares, writes diff images, exits non-zero on diff.
- [x] 5.4 Add scripts: `display-case` (dev server) and `display-case check --a11y --visual [--update]`.

## 6. Coverage lint check

- [x] 6.1 Add `tools/lint/src/checks/display-case-coverage.ts`: read each showcased library's config, enumerate exported components from the package entry, assert a colocated `*.case.tsx` exists for each, fail naming any uncovered components.
- [x] 6.2 Register it in `tools/lint/src/index.ts`, add a `lint:display-case-coverage` script, and add a unit test alongside the other `tools/lint` check tests.

## 7. Acme UI integration

- [x] 7.1 Add `packages/ui/display-case.config.ts` (title, `roots`, `globalStyles` → `tokens.css` + `components.css`).
- [x] 7.2 Author `*.case.tsx` for every exported component (Alert, Badge, Button, Calendar, Card, Checkbox, CodeField, HighlightCard/DetailPage, FormField, icons, Input, Navbar, ViewTransition, Combobox, Select, OptionCard, Skeleton, Field, Form, DataGrid, Textarea, ThemeToggle, Datepicker), each tagged with its hierarchy level (atom/molecule/organism/template/page) and covering meaningful variants/states and tweaks where useful.
- [x] 7.3 Add at least one `definePrototype` flow assembled from ui primitives (e.g. a passwordless sign-in flow: request link → check email → signed in) to exercise the prototype level and multi-page navigation.
- [x] 7.4 Record initial visual-regression baselines for all cases including prototype pages (light + dark) into the gitignored `.display-case/baselines/` cache (not committed); confirm a re-run reports no changes.
- [x] 7.5 Add `display-case` + `display-case:check` scripts to ui and root convenience scripts; add `.display-case/` to `.gitignore`.
- [x] 7.6 Remove the untracked `packages/ui/.preview/` harness.

## 8. Package documentation

- [x] 8.1 Write `packages/display-case/README.md` — pitch, why-not-Storybook, install/prereqs, 60-second quick start, feature tour, and a table of contents linking into `docs/`.
- [x] 8.2 Write the `docs/` guide pages: `quick-start.md`, `writing-cases.md`, `hierarchy.md` (Atomic Design levels + prototypes/flows), `tweaks.md`, `theming.md`, `documentation-panel.md`, `testing.md`, `cli.md`, `ai-agents.md`, `configuration.md` — each example-led with relative cross-links and a clear nav order.
- [x] 8.3 Add `docs/examples/` runnable example case files (plain case, tweaks case, multi-variant case) and reference them from the guides so snippets stay real.
- [x] 8.4 Verify every documented command, flag, config option, and endpoint matches the implementation; ensure all relative doc links resolve.

## 9. Verification and finalize

- [x] 9.1 Run Display Case: confirm the sidebar groups components by hierarchy level; confirm every component renders in light and dark and at a narrowed viewport; deep-link a case URL (with tweaks) and confirm direct render; step through the prototype flow and deep-link one of its pages; toggle the doc panel.
- [x] 9.2 Confirm `/manifest.json` and `--print-manifest` list every component/case with addresses, tweak schema, and file references (paths, not inlined); confirm `/render/...?theme=dark` is chrome-free.
- [x] 9.3 Run `display-case check --a11y --visual`: confirm a11y passes (or fix violations) and VR matches baselines; confirm both exit non-zero on an intentional regression.
- [x] 9.4 Confirm the coverage lint check fails when a case is removed and passes at full coverage; confirm no app build includes Display Case (dev-only); run `bun run lint` and type checks.
- [x] 9.5 Cross-reference Display Case from `packages/ui/README.md` and `AGENTS.md` (launch, AI endpoints, tweaks, checks, case-file convention, link to package docs); run `openspec validate add-display-case --strict`.

## Implementation notes (as-built deviations)

- **3.1 / 2.2 — bundling**: only `render-entry.tsx` is codegen'd; `browser-entry.tsx` is a static module that fetches `/manifest.json` (so case modules bundle only into the render entry, never the chrome). Entries are bundled with `Bun.build` to `.display-case/dist` and served by a plain `Bun.serve` fetch handler with rebuild-on-watch, rather than the HTML-import HMR pattern — see design D3 "as-built note". Behaviour is unchanged; refresh replaces in-page HMR.
- **3.2 — manifest**: each case carries `browseUrl`/`renderUrl`/`tweaks`; per-component `caseFile`/`promptDoc`/`level` are repo-relative paths. A per-case `baseline` path is intentionally omitted (baselines are a local cache and there are two per case — one per theme); the configured `baselineDir` is the reference instead.
- **6.1 — coverage check**: enumerates component files via the consumer's `roots` globs (each `…/*.case.tsx` root ⇒ `…/*.tsx` component modules) rather than parsing the package entry — more robust and config-driven. Escape hatch: `// display-case: no-case <reason>`.
- **a11y runner**: checks WCAG 2 A/AA (`.withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa'])`); page-structure best-practice rules (page-has-heading-one, regions, heading-order) are out of scope for isolated component fragments. The runner surfaced genuine pre-existing ui findings (color-contrast, an unnamed Form progressbar) — these are flagged for a separate follow-up, not silenced.
