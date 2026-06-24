# Display Case

A Bun-native, AI-friendly component showcase — a lightweight alternative to Storybook. Colocate `*.case.tsx` files next to your components, run one command, and browse every variant in an isolated preview. There is no Vite, no Webpack, and no config server: discovery, bundling, and serving are all done with Bun's built-in bundler and `Bun.serve`. It is strictly a development tool and is never bundled into an app build.

```tsx
// tweak-control.case.tsx — colocated with tweak-control.tsx
import { defineCases } from '@awarebydefault/display-case'
import { TweakControl } from './tweak-control'

export default defineCases('TweakControl', {
  Text: () => <TweakControl kind="text" label="Label" value="Save" />,
  Boolean: () => <TweakControl kind="boolean" label="Disabled" value={false} />,
}, { level: 'atom' })
```

```bash
bunx @awarebydefault/display-case .         # browse at http://localhost:3100
```

> Display Case **dogfoods itself**: the example above (and throughout these docs) showcases its own UI parts — `TweakControl`, `FlowNav`, `TweaksPanel`, `Sidebar`, `Shell`.

## Why not Storybook

- **No bundler config.** Storybook ships its own Vite/Webpack stack and addon ecosystem. Display Case uses the Bun bundler and `Bun.serve` directly — the only moving parts are the case files you write.
- **Plain data, lazy renders.** A case file default-exports a value, not a registry of side effects. Render functions are lazy thunks, so the server can import every module to build a manifest *without rendering anything*. This keeps discovery fast and import-safe.
- **Built for machine readers.** A single `/manifest.json` enumerates every component, case, doc, and tweak as file references. Any case renders in isolation at a deterministic URL, so an AI agent (or a screenshot tool) can snapshot exactly one variant. See [AI agents](docs/ai-agents.md).
- **Atomic Design hierarchy.** Cases declare a `level` (`atom` → `flow`); the sidebar groups by it. Each component's variants collapse under its name (collapsed by default — the chevron toggles them); clicking the name opens its first variant, so [order the most exploratory variant first](docs/writing-cases.md#order-the-default-landing-variant-first). Multi-step behavioural flows are first-class via `defineFlow`.

## Install

```bash
bun add -D @awarebydefault/display-case   # dev dependency — it never ships in your app build
```

Display Case is **Bun-native at runtime**, so it is published as TypeScript
source that Bun runs directly. It requires the [Bun](https://bun.sh) runtime
(not just Bun as an installer); running the CLI under Node exits with a notice.

## Prerequisites

- [Bun](https://bun.sh) ≥ 1.2 (the dev server and bundler are Bun-native, and
  the CLI runs on the Bun runtime).
- React 19 (peer dependency).
- For a default-backed `check` (a11y + visual regression): the visual toolchain (`playwright`, `@axe-core/playwright`, `pixelmatch`, `pngjs` + Chromium). These are **optional** and loaded lazily — browsing, `--print-manifest`, and `/render` snapshotting need none of them. Set it up on demand with `display-case init <pkgDir> --with-visual` (or `bunx playwright install chromium` after adding the deps), or replace it entirely with a custom `providers` backend. See [Testing](docs/testing.md#the-default-backend-is-lazy-and-optional).

## Usage

Display Case is a per-package tool: one config, one manifest, one port. Point it at the package whose components you want to browse. Three steps get you running.

1. **Add a config** (`display-case.config.ts` at the package root) — see the [60-second quick start](#60-second-quick-start) below.
2. **Write cases** — colocate a `*.case.tsx` next to each component.
3. **Run it** — wire up two npm scripts and use them:

   ```jsonc
   // package.json
   {
     "scripts": {
       "display-case": "display-case .",
       "display-case:check": "display-case check ."
     }
   }
   ```

   ```bash
   bun run display-case             # dev server  → http://localhost:3100
   bun run display-case:check       # all phases: structure + tokens + ssr + a11y + visual-regression
   bun run display-case:check --structure --tokens --ssr   # static phases only (no browser)
   ```

   Or invoke the CLI directly without scripts:

   ```bash
   bunx @awarebydefault/display-case .              # dev server
   bunx @awarebydefault/display-case check .        # all checks
   ```

   The target is `.` for the current package or an explicit `<pkgDir>`. `.`
   resolves the nearest `display-case.config.ts` walking up from the current
   directory, so it works from a package root or any subdirectory. The bare
   `bunx @awarebydefault/display-case` (no argument) is **identical to `.`** — same cwd-based
   resolution — so `bunx @awarebydefault/display-case` and `bunx @awarebydefault/display-case .` behave the same.

Display Case **dogfoods itself**: its own UI parts — `TweakControl`, `FlowNav`, `TweaksPanel`, `DocPanel`, `Sidebar`, `Shell` — are the kind of components you would case, and the [examples](docs/examples/) use them as their subjects. Page/flow cases that need app chrome typically live in a dedicated `page-cases/` directory (not colocated with route files) so the coverage lint isn't forced onto every route.

The dogfooding goes one layer deeper: the browse chrome has its **own design system** — "The Vitrine" — that lives inside this package at [`src/ui/design-system/`](src/ui/design-system/). Warm paper neutrals, a single marigold accent, Hanken Grotesk + JetBrains Mono, flat and border-led so the showcased component owns the visual weight. `chrome.css` is styled entirely from its `--dc-*` tokens — no host-app library, no borrowed tokens. The server inlines the token layer ahead of `chrome.css` and links the webfonts; the design system is kept in sync with its [claude.ai/design](https://claude.ai/design) source via `/design-sync`.

### Developing Display Case itself

Display Case **dogfoods itself** — `display-case.config.ts` points the showcase
at its own "Vitrine" design-system components, so `bun dev` browses the very
chrome you're editing. Package scripts that target work on the tool (not on
consumer cases):

```bash
bun run setup        # first-time setup: deps + the Playwright Chromium browser
bun dev              # showcase this package, with live reload of the app chrome
bun run check        # static gate: structure + tokens + ssr (browser-free)
bun test             # unit / type tests
bun run e2e          # Playwright e2e tests for the browse chrome (boots its own server)
```

`bun run setup` is idempotent — it runs `bun install` and installs the Chromium
binary the e2e suite drives. There is no Docker, no service stack, and no `.env`
to provision; Display Case is a self-contained dev tool.

Contributor guides — coding/testing/linting best practices, worktree-safe
execution, and the OpenSpec specs — live under [`contributing/`](contributing/)
(kept separate from this product `docs/` tree). See [AGENTS.md](AGENTS.md).

The browse chrome has its own Playwright e2e suite under [`e2e/`](e2e/) — it
launches a real Display Case server and drives the shell, navigation, docs panel,
and Primer. Locators are the `data-testid`s in
[`src/ui/test-ids.ts`](src/ui/test-ids.ts). Run `bun run e2e:install` once to
fetch Chromium. See [e2e/README.md](e2e/README.md).

The running server watches and live-reloads by default: editing a case, a component's implementation, a style, a doc, or the primer rebuilds and reloads the stage iframe in place (and refetches the manifest, so added/removed cases appear) — the selection is preserved. `bun dev` adds `--dev` on top, for iterating on **Display Case itself**: it also watches the chrome's own source and re-reads the inlined chrome CSS, and the shell does a full page reload on rebuild (the chrome bundle may have changed). Backend edits (the server, discovery, …) still need a manual restart; the page auto-reloads on the reconnect that follows. (We deliberately don't wrap it in `bun --watch`: re-invoking `Bun.build` inside a watch process corrupts module resolution.)

With `a11y.enabled` set (see [Configuration](docs/configuration.md#a11y)), the running chrome also surfaces accessibility results live — a per-variant marker in the nav and an Accessibility panel beside the case — scanned on demand for the viewed variant, cached, and re-evaluated when you edit the component. It's opt-in because it uses the same optional Playwright + axe toolchain as `check`; without it the panel shows an *unavailable* state and the server still browses normally.

With no phase flag, `check` runs every phase (minus any opted out via `check.defaultPhases`); naming a phase (`--structure`, `--a11y`, `--visual`, `--tokens`, `--ssr`) runs only those. The **structure** phase is a static set of best-practice rules — case+prompt coverage, hierarchy-level classification, primer presence, snapshot setup, flow/slug/tweak integrity, interactive cases keyed for in-place swaps, and opt-in composition (import-graph) rules — each with a `warn`/`error` severity (only errors fail the run; `--strict` escalates warnings). The **token** phase is a static parse — it flags any `var(--token)` that resolves to no custom property the package defines (in `globalStyles` or an inline `style` object), catching foreign/typo'd token names that silently fall back to a hardcoded value. A `var(--x, fallback)` is still flagged: the rule is vocabulary conformance, not CSS validity. Exempt a reference with an `allow: unknown-token` comment, or list host-app-provided tokens under `tokens.allow` in the config. The **ssr** phase renders every case on the server (no browser) and fails on any that can't render before scripts run — i.e. that touch a browser-only API *during render*. It's the enforced form of "keep render pure" and a precise alternative to a static "no browser APIs" lint (which would wrongly flag legitimate effect/handler usage). A component that genuinely needs a browser opts out with `browserOnly: true` in its case meta, which also makes Display Case render it on the client wherever it appears.

The three static phases — **`--structure`**, **`--tokens`**, and **`--ssr`** — are the ones worth gating a showcased package on in CI: they need no browser and run in milliseconds. The structure phase's `case-placard-coverage` rule subsumes the standalone "every component has a colocated `*.case.tsx`" check. Wire `display-case check --structure --tokens --ssr` into your lint/CI step. Full rule list and escape hatches: [Testing → Structure checks](docs/testing.md#structure-checks); per-rule config: [Configuration → `check`](docs/configuration.md#check).

## Agent setup (`init` / `uninstall`)

Display Case is built to be driven by AI agents, and one command wires a repo up for that:

```bash
display-case init <pkgDir> [--agent=claude] [--with-visual] [--dry-run] [--json]
display-case uninstall <pkgDir> [--agent=claude] [--dry-run] [--json]
```

`init` makes a repo agent-ready by, **idempotently**:

- merging a `display-case` entry into the agent's launch config (`.claude/launch.json` for Claude Code) — never touching your other entries;
- installing the bundled skills (`display-case-snapshot`, `display-case-author-case`, `display-case-author-placard-doc`, `display-case-review`) into the agent's skills directory (`.claude/skills/`);
- adding a sentinel-marked **agent-guide pointer** to your instructions file (`AGENTS.md` if present, else `CLAUDE.md`).

`uninstall` reverses exactly those, and **only** those — it removes the `display-case` launch entry, the bundled skills, and the pointer block, leaving anything you authored untouched.

Both commands are safe to re-run: a second `init` converges to the bundled state — unchanged artifacts report `skipped`, and any that drifted (a skill, the launch entry, or the agent-guide pointer block) are reconciled in place and reported as `updated`. `uninstall` on a clean repo reports nothing to remove. Guarantees:

- **`--dry-run`** — print the plan without writing or removing anything.
- **`--json`** — emit the plan/report as machine-readable JSON (`{ command, agent, dryRun, items: [{ artifact, action, detail }] }`) for agent consumption; the default output is human-readable.
- **`--agent=<id>`** — choose the target agent (default `claude`); an unsupported agent fails fast and writes nothing.
- **`--with-visual`** (init only) — also set up the optional visual-regression toolchain (`bun add --dev playwright @axe-core/playwright pixelmatch pngjs`, then `bunx playwright install chromium`). Omitted, the step is skipped; in an interactive TTY, `init` prompts for it. Needed only for a default-backed `check` — see [Testing](docs/testing.md#the-default-backend-is-lazy-and-optional).

Once installed, an agent can browse, snapshot, document, and review components via the bundled skills and the [AI-agent guide](docs/ai-agents.md).

### Worktree-safe by default

Agents often work in a **git worktree** (an isolated checkout) so their edits don't touch your working copy. Display Case is built for this: it holds no global or main-repo state. Resolution, the `.display-case/` build cache, and repo-relative paths all anchor to the package you point it at — so a worktree's run stays entirely inside that worktree, and two checkouts never clobber each other's output. An agent's component edits show up in the showcase it serves.

There are just two ways to name the target, both anchored where you'd expect:

- **`.` (or no argument)** — discovers the nearest `display-case.config.ts` walking up from the current directory. Run from anywhere inside the worktree (any depth) and you get that worktree's package.
- **explicit `<pkgDir>`** (`display-case apps/foo`) — used as given, and validated to contain a `display-case.config.ts` (a wrong directory fails loudly rather than serving an empty showcase). Relative paths resolve against the current directory, so a worktree-relative path stays in the worktree.

The one rule: launch it from inside the worktree (cwd within the checkout), or pass a worktree path explicitly — don't rely on a process cwd that points at a sibling checkout. Agent launch configs (`.claude/launch.json`) pass an explicit package path for exactly this reason.

## 60-second quick start

1. Add a config at your package root:

   ```ts
   // display-case.config.ts
   import { defineConfig } from '@awarebydefault/display-case'

   export default defineConfig({
     title: 'Display Case',
     roots: ['src/components/**/*.case.tsx'],
     globalStyles: ['./src/tokens.css', './src/components.css'],
   })
   ```

2. Write a case file next to a component:

   ```tsx
   // src/components/tweak-control.case.tsx
   import { defineCases } from '@awarebydefault/display-case'
   import { TweakControl } from './tweak-control'

   export default defineCases('TweakControl', {
     Variants: () => (
       <div style={{ display: 'flex', gap: '0.5rem' }}>
         <TweakControl kind="text" label="Label" value="Save" />
         <TweakControl kind="boolean" label="Disabled" value={false} />
       </div>
     ),
   }, { level: 'atom' })
   ```

3. Start the server and open the printed URL:

   ```bash
   bunx @awarebydefault/display-case .            # or `bun run display-case` once the script is wired up
   ```

Full walkthrough: [Quick start](docs/quick-start.md).

## Feature tour

**Typed tweaks** — interactive controls whose values are URL-encoded, so a tweaked state is shareable and snapshottable.

```tsx
import { defineCases, tweak } from '@awarebydefault/display-case'
import { TweakControl } from './tweak-control'

export default defineCases('TweakControl', {
  Playground: {
    tweaks: {
      label: tweak.text('Opacity'),
      kind: tweak.choice(['text', 'boolean', 'choice'], 'choice'),
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
})
```

**Flows** — interactive multi-step flows, each step individually addressable, with in-step `goto` transitions and preset step state.

```tsx
import { defineFlow } from '@awarebydefault/display-case'

export default defineFlow('Sign-in flow', {
  steps: {
    'Request link': {
      transitions: ['Check email'],
      render: ({ goto }) => <RequestLink onSubmit={() => goto('Check email')} />,
    },
    'Check email': { render: () => <CheckEmail /> },
  },
})
```

**Documentation panel** — a component's sibling `<component>.placard.md` renders alongside its cases as full CommonMark + GFM.

**Isolated render endpoint** — every case is also reachable at `/render/<component>/<case>`, the exact document the browse iframe embeds and the check runner screenshots.

**Pre-scripting (server) rendering** — the isolated `/render/<component>/<case>` document and the `/render/primer` document are rendered to complete, themed HTML on the server *before* the page's scripts run. Fetch the address without executing it (a crawler, a screenshot before scripts settle, plain `curl`) and the case content — under the requested `?theme=` and tweaks — is already there; the client then *adopts* that markup (hydrates) to drive interactivity (tweaks, in-place swaps, the primer's scrollspy). This is the groundwork for hosting a Display Case as a real webapp beyond localhost. Two things to know as an author:

- **Browser-only cases fall back automatically.** A case (or component) that touches a browser-only API (`window`, layout measurement, canvas…) *while rendering* throws on the server; Display Case catches it, delivers that case's document empty, and the client renders it — the surrounding surface is unaffected. The console logs which case fell back.
- **Keep render deterministic.** Pre-rendering means the server and client must produce the same markup. A case that uses `Date.now()`, `Math.random()`, or locale/timezone-dependent formatting *during render* will mismatch on adopt (the client re-renders it and logs `adopt mismatch`). These already make a case a poor snapshot subject — pass such values in as fixed tweaks instead.

**App chrome** — the [`decorator`](docs/configuration.md#decorator) receives each case's `level`, `sourcePath`, and `area`, so a consuming app can render **page**/**flow** cases inside their real navigation/layout (and leave smaller components bare). Tag a case with `meta.area`, or organize cases into area folders and read `sourcePath`.

**CSS-in-JS (Material UI / emotion)** — components styled by a runtime CSS-in-JS library are first-class. A [**style engine**](docs/style-engines.md) collects the styling emitted *during* the server render and delivers it before scripting, so emotion/MUI (and styled-components) cases are styled in the chrome-free snapshot with **no flash** — not a `browserOnly` opt-out. Configure `styleEngines` (server-side extraction) alongside the `decorator` (the `ThemeProvider`); Display Case takes on no runtime dependency on the styling library. Static CSS (Tailwind output, design tokens) goes through [`globalStyles`](docs/configuration.md#globalstyles) instead.

**Browse modes** — the sidebar mode switch offers the modes that have content: **Components** (the building-block kit, grouped by Atomic-Design level), **Exhibits** (page/flow surfaces, grouped by their information architecture), and **Primer** (below). Components cases address as `/c/<component>/<case>`, Exhibits as `/e/<component>/<case>`. See [Hierarchy](docs/hierarchy.md#components-and-exhibits).

**Primer** — point `primer` at an authored `.mdx` document and a **Primer** tab joins the mode switch. The Primer is long-form "wall text": a scrolling reading page with embedded **live specimens**, rendered in its own isolated frame (like `/render`). The MDX may import any component — case files *and* arbitrary `.tsx` — and wraps each specimen in the `<Display>` contract:

```mdx
import { Button } from './components'

# Our design system

<Display title="Button" subtitle="The one true action" theme="dark">
  <Button variant="accent">Snapshot</Button>
</Display>
```

`<Display>` takes `title` (also the sidebar table-of-contents entry + scroll anchor), an optional `subtitle`, and an optional `theme` that forces a light/dark scope inside that card only — so a dark-mode component sits correctly on a light page. `<Display>` is provided to the MDX automatically; no import needed. In the table of contents, each `<Display>` nests under the `#`/`##` heading above it; those headings are themselves navigable, collapsible group headers (the `#` page title is the "top of page" entry), and long entries truncate with an ellipsis.

The Primer is a real browse route — `/primer` (the chrome-free document lives at the reserved `/render/primer`) — so the mode switch is a navigation step that back/forward cross and a copied link reopens. The chrome lands at the root path on the [`landing`](docs/configuration.md#landing) mode (`'primer' | 'components' | 'exhibits'`, honored when that mode is present; default the Primer when configured). The explicit `/primer` route always opens the Primer, and a case deep link always opens that case in its mode, regardless of the setting.

**Device toolbar** — the browse chrome's header carries the viewport controls: a **Responsive** mode (full / preset widths with manual zoom) and **fixed device sizes** (1080p, 4K, iPhone, iPad, Pixel, … or a custom `W × H`, with a rotate button) that render the iframe at exact pixels and auto-scale to fit the panel — like Chrome DevTools' device mode.

**Browser-safe bundling** — the render bundle inlines the consumer's `BUN_PUBLIC_*` env (so a `process.env.*` read in app code doesn't throw `process is not defined` and blank the showcase), neutralizes anchor clicks that would unload the isolated frame, and shows an explanatory banner if a bundled module still references a Node/Bun runtime global.

**Checks** — `display-case check` runs five phases: structure best-practice rules, design-token conformance (a static parse of `var()` references against the package's defined tokens), server-render safety (`ssr`: every case must render before scripts run), axe-core accessibility audits, and pixel-diff visual regression against stored baselines. The first three are browser-free and CI-friendly.

## Publishing (hosting beyond localhost)

The dev server is for authoring on `localhost`. To host a showcase for a team, build a self-contained, deployable artifact:

```bash
display-case publish <pkgDir> [--out=<dir>] [--base=<path>] [--static]
```

Every surface — the browse shell (`/` and `/c/<component>/<case>` deep links), each isolated `/render/<component>/<case>`, and the primer — is **server-rendered before scripts run** and hydrates on the client, so the build reads (and screenshots, and crawls) without executing JS. The build is production-grade by default: minified, **content-hashed** assets (cached `immutable`), HTML served `no-cache`, **no** development machinery (no file watching, no live-reload stream, no on-demand a11y, no dev endpoints), and reproducible output.

Two forms:

- **Served (default)** — a thin production server (`server.ts`) plus the hashed asset bundle, a frozen manifest, a `package.json`, and a `Dockerfile` (with a `/health` check). Run it with `bun server.ts`, or build the Dockerfile and deploy it like any other service (one Dockerfile per service). It renders documents on request, so address-encoded themes/tweaks (`?theme=dark`, `?t.x=…`) are server-rendered at full fidelity. `--base=/showcase` hosts it under a subpath.
- **Static (`--static`)** — crawls every address and writes complete HTML files plus the bundle, hostable on any static file host with **no running server**. Files are keyed by path (default theme/tweaks); a query-encoded variation that has no per-path file resolves on the client after hydration (logged, not silently dropped).

The live accessibility scanner is a dev-only surface and is omitted from a published build. Display Case is still never bundled into a *consuming* application — a published showcase is its own, separate artifact you deploy on purpose.

## Documentation

- [Quick start](docs/quick-start.md) — install, configure, and browse in a few minutes.
- [Writing cases](docs/writing-cases.md) — the `defineCases` / `defineFlow` authoring API.
- [Hierarchy](docs/hierarchy.md) — Atomic Design levels and flows.
- [Tweaks](docs/tweaks.md) — typed, URL-encoded controls.
- [Theming](docs/theming.md) — global styles, decorators, light/dark, viewport width.
- [Style engines](docs/style-engines.md) — CSS-in-JS (Material UI / emotion) styled before scripting.
- [Documentation panel](docs/documentation-panel.md) — rendering `.placard.md`.
- [Writing placard docs](docs/writing-placard-docs.md) — what to put in a `.placard.md`, for agents and humans.
- [Testing](docs/testing.md) — a11y + visual-regression checks and baselines.
- [CLI](docs/cli.md) — every command and flag.
- [AI agents](docs/ai-agents.md) — the manifest, render snapshotting, recommended workflow.
- [Configuration](docs/configuration.md) — full `defineConfig` reference.
- [Examples](docs/examples/) — runnable example case and placard-doc files.
