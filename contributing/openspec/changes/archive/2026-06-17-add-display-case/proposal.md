## Why

Acme UI (`@acme/ui`) is a shared foundation used across many surfaces, but there is no way to browse its components in isolation. Today the only options are reading source, reading the `.prompt.md` files, or wiring a throwaway preview harness (the untracked `.preview/` one-off built for Datepicker). Contributors — human and AI — cannot reliably see what a component looks like across its variants, themes, and states, and AI agents have no deterministic way to render or snapshot a single component without booting the whole app.

Storybook is the conventional answer, but it requires a Vite or Webpack builder; this monorepo is deliberately Bun-native (Bun bundler + `Bun.serve`, no Vite/Webpack anywhere). We want a small, owned tool that fits the stack and is first-class for AI agents rather than a heavyweight third-party dependency.

## What Changes

- Introduce **Display Case** — a Bun-native component showcase tool (a lightweight Storybook alternative) in a new `packages/display-case` workspace package.
- Define a **case file** convention: component authors colocate `*.case.tsx` files next to components, each exporting one or more named "cases" (a component variant/state) with optional metadata.
- Display Case **discovers** all case files via glob, bundles them with Bun's native bundler, and serves a browsing UI from `Bun.serve`: a sidebar grouped by component, a rendered preview pane, and light/dark theme switching (via `data-theme`) plus a viewport-width control.
- Each case is addressable at a **stable URL** so it can be rendered, navigated, and screenshotted deterministically.
- Classify each showcased component by its place in an **Atomic Design hierarchy** (atom → molecule → organism → template → page), declared in the case file; the browsing UI and manifest group and order components by level.
- Add a new top hierarchy level — **prototype** — that composes multiple pages to demonstrate **multi-page behaviours and user flows**: a viewer can step through the flow's pages, and each page is individually addressable and snapshottable.
- Add **tweaks** — an interactive controls panel that lets a viewer adjust a case's declared inputs (text, boolean, enum, number) live, with the current tweak values encoded in the case's address so a tweaked state is shareable and snapshottable.
- Surface each component's authored usage notes inline: a **show/hide documentation panel** in the preview that renders the component's `.prompt.md` as full CommonMark + GFM markdown (headings, tables, lists, blockquotes, task lists, etc.) — not a ui-specific subset, since Display Case is built as a standalone package.
- Add an **accessibility check runner** and a **visual-regression runner** over the cases: a11y violations and pixel diffs against recorded baselines are reported per case and runnable headlessly. The baseline location is configurable in `display-case.config.ts` (defaulting to the gitignored cache dir; point it at a committed directory for shared/CI baselines).
- Expose **machine-readable endpoints** for AI agents: a manifest that acts as a *directory* — listing every component, its cases, tweak schemas, and **file references** (the component's `.prompt.md`, the case file, the VR baseline) rather than inlined content; plus a per-case isolated render so an agent can snapshot a single component without the surrounding chrome.
- Add a **lint check** that fails the pipeline when an exported showcased component has no colocated `*.case.tsx`, so coverage cannot silently regress.
- Author **case files for all ui components** (~27) covering their meaningful variants/states and tweaks where useful.
- Ship **standalone-grade documentation** with the package — written as if Display Case were its own published npm package with a docs website: a root `README.md`, a quick-start, and a set of tutorial/guide pages (writing cases, tweaks, theming, the documentation panel, a11y + visual-regression testing, the CLI, the AI-agent endpoints, configuration) plus runnable examples.
- Add workspace scripts to launch Display Case and to run its a11y + visual-regression checks; cross-reference the package docs from the ui README and `AGENTS.md`.
- Retire the throwaway `packages/ui/.preview/` harness in favour of Display Case.

## Capabilities

### New Capabilities
- `display-case`: a developer tool that discovers colocated component case files, renders each component variant in an isolated, theme-switchable browser surface at stable addresses with live tweaks and an inline rendered documentation panel, runs accessibility and visual-regression checks over those cases, and exposes a machine-readable manifest (a directory of file references) and isolated-render endpoints so both humans and AI agents can browse, snapshot, and verify UI components without running the full application.

### Modified Capabilities
- `lint-pipeline`: add a check that fails when an exported component from a showcased library has no colocated case file, enforcing Display Case coverage.

## Impact

- **New package**: `packages/display-case/` (the tool: discovery, bundler glue, dev server, browser UI, tweaks, doc panel, a11y + visual-regression runners, machine endpoints) plus a `README.md` and a `docs/` tree of quick-start + tutorial pages and `examples/`, authored to standalone-npm-package quality.
- **ui**: adds `*.case.tsx` siblings under `packages/ui/src/components/`; removes the untracked `.preview/` directory; README gains a Display Case section. Visual-regression baselines are recorded into the gitignored `.display-case/` cache (not committed).
- **lint pipeline**: a new check (`tools/lint/`) asserting every exported showcased component has a case file; wired into `bun run lint` and the existing `lint:*` script set.
- **Root**: new workspace scripts (e.g. `bun run display-case`, `bun run display-case:check`); `AGENTS.md` documents the tool and the AI-facing endpoints.
- **Dependencies**: no Vite/Webpack; relies on Bun's bundler + `Bun.serve` and React 19 (already present). The a11y/visual-regression runners drive a headless browser (Playwright, already used by e2e) plus a lightweight axe-core a11y pass. The doc panel uses `react-markdown` + `remark-gfm` for full markdown. All are dev-only deps of the `display-case` package — no production runtime impact, and Display Case is not shipped in any app image.
