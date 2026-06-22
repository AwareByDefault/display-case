# Configuration

> Nav: [Quick start](quick-start.md) · [Writing cases](writing-cases.md) · [Hierarchy](hierarchy.md) · [Tweaks](tweaks.md) · [Theming](theming.md) · [Style engines](style-engines.md) · [Documentation panel](documentation-panel.md) · [Writing placard docs](writing-placard-docs.md) · [Testing](testing.md) · [CLI](cli.md) · [AI agents](ai-agents.md) · **Configuration**

Display Case is configured by a single `display-case.config.ts` (or `.tsx`) file at the root of the package it showcases. The file must **default-export** `defineConfig(...)`; if it does not, the CLI errors. `defineConfig` is an identity helper that exists purely to give the config file full type-checking and inference.

```ts
// display-case.config.ts
import { defineConfig } from '@awarebydefault/display-case'
import { ThemeProvider } from './src/components/theme-provider'

export default defineConfig({
  title: 'Display Case',
  roots: ['src/components/**/*.case.tsx'],
  globalStyles: ['./src/tokens.css', './src/components.css'],
  decorator: ThemeProvider,
  baselineDir: 'baselines',
})
```

The CLI looks for `display-case.config.ts` then `display-case.config.tsx` in the package directory.

## Reference

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `title` | `string` | yes | — | Shown in the browsing chrome and the manifest. |
| `roots` | `string[]` | yes | — | Globs (relative to the package) locating `*.case.tsx` files. |
| `primer` | `string` | no | none | Path (relative to the package) to an `.mdx` document rendered as the Primer reading page. When set, the chrome shows a Primer / Cases mode switch. See [`primer`](#primer). |
| `landing` | `'primer' \| 'cases'` | no | `'primer'` | Which view the chrome lands on at `/` when a Primer is configured. Ignored without a Primer. See [`landing`](#landing). |
| `globalStyles` | `string[]` | no | none | CSS entrypoints (relative to the package) injected into previews. |
| `decorator` | `ComponentType<{ children, level?, sourcePath?, area? }>` | no | none | Wrapper rendered around every case; also receives the active case's `level`, `sourcePath`, and `area` so it can wrap page/flow cases in app chrome. |
| `styleEngines` | `StyleEngine[]` | no | none | Engines that collect render-time (CSS-in-JS) styling — emotion/MUI, styled-components — during the server render and deliver it before scripting. Pair with `decorator`. See [`styleEngines`](#styleengines) and [Style engines](style-engines.md). |
| `baselineDir` | `string` | no | `.display-case/baselines` | Where visual-regression baselines are stored. |
| `tokens` | `{ allow?: string[] }` | no | none | Design-token conformance options for `--tokens`. `allow` lists custom-property names the package may reference but does not itself define (e.g. host-app-provided tokens). See [Testing](testing.md#token-conformance). |
| `providers` | `{ driver?, diff? }` | no | built-in | Override the visual-regression backend. When unset, the built-in Playwright/axe driver and pixelmatch/pngjs diff are loaded lazily. See [`providers`](#providers). |
| `check` | `{ defaultPhases?, structure? }` | no | none | Tune the `check` command: which phases run by default, and the structure phase's rules and severities. See [`check`](#check). |
| `a11y` | `{ enabled?, themes?, exclude?, startup? }` | no | off | Live accessibility surfacing in the running browse chrome. See [`a11y`](#a11y). |

### `title`

The library name. Appears in the browse shell header and in `/manifest.json` as the top-level `title`.

### `roots`

One or more glob patterns, resolved relative to the package directory, that select your case files. Matches under any `node_modules/` are ignored, and results are de-duplicated. Most libraries need just one:

```ts
roots: ['src/components/**/*.case.tsx']
```

### `globalStyles`

CSS files concatenated and injected into both the browse shell and the isolated render document, so components render with their real tokens and styles. Paths are resolved relative to the package; a listed file that does not exist is skipped silently. See [Theming](theming.md).

```ts
globalStyles: ['./src/tokens.css', './src/components.css']
```

### `primer`

Path (relative to the package) to an `.mdx` document rendered as the **Primer** — a long-form reading page with embedded live specimens, shown via a Primer / Cases mode switch the chrome adds to the sidebar. The MDX is bundled into its own isolated frame (like `/render`), so it can import any component — case files *and* arbitrary `.tsx` — without risking the browse chrome.

```ts
primer: './src/design-system/primer.mdx'
```

Wrap each live specimen in the `<Display>` contract (provided to the MDX automatically — no import needed):

```mdx
import { Button } from './components'

# Our design system

The wall text that orients you before browsing the cases.

<Display title="Button" subtitle="The one true action" theme="dark">
  <Button variant="accent">Snapshot</Button>
</Display>
```

`<Display>` props:

| Prop | Type | Description |
| --- | --- | --- |
| `title` | `string` | Specimen title; also the sidebar table-of-contents entry and scroll anchor. |
| `subtitle` | `string` | Optional one-line description under the title. |
| `theme` | `'light' \| 'dark'` | Optional — forces a theme scope inside the card only, so a dark-mode component reads correctly on a light page (and vice versa). Omit to inherit the page theme. |
| `flush` | `boolean` | Optional — drop the card's own border and padding so a single self-bordered child fills the box edge-to-edge (avoids a box-within-a-box). |
| `appSurface` | `boolean` | Optional — paint the card with the consumer design system's own canvas (`--color-bg`/`--color-fg`, the same tokens the `/render` frame paints) instead of the Vitrine's `--dc-bg`, so the specimen sits on the exact background the real app gives it. Combine with `theme` for the app's themed surface; degrades to `--dc-bg` when no `--color-bg` is defined. |

The sidebar reflects each `<Display>` title as a table-of-contents entry, grouped under the `#`/`##` heading that precedes it — each heading is itself a navigable, collapsible group header (the `#` page title doubles as the "top of page" entry). Any `<Display>`s before the first heading fall into a leading "Contents" group. Long entries truncate with an ellipsis. Scrollspy highlights the heading or section in view. Toggling the chrome's light/dark theme drives the Primer too.

### `landing`

Which view the chrome shows first when you open the root path (`/`): the Primer reading page (`'primer'`, the default) or the Cases library (`'cases'`). Use `'cases'` when the components are the main event and the Primer is supplementary reference:

```ts
primer: './src/design-system/primer.mdx',
landing: 'cases',
```

This setting only governs the **bare `/` landing**. The canonical [`/primer`](#primer) route always opens the Primer (it's an explicit request), and a case deep link (`/c/...`) always opens the library — both regardless of `landing`. The option only takes effect when a `primer` is configured; without one there is no Primer to land on, so the library is always the landing view.

### `decorator`

A single React component that wraps every rendered case (for a theme provider, context, or a fixed frame). It is applied inside React `StrictMode`. See [Theming](theming.md#decorator).

```ts
import { ThemeProvider } from './src/components/theme-provider'
// …
decorator: ThemeProvider,
```

Besides `children`, the decorator receives the active case's identity so it can
wrap **page** and **flow** cases in app chrome (a nav header, sidebar, footer)
while leaving smaller components bare:

```ts
decorator?: ComponentType<{
  children: ReactNode
  level?: HierarchyLevel   // 'atom' | … | 'page' | 'flow' (from defineCases/defineFlow)
  sourcePath?: string      // case file path, package-relative (folder convention)
  area?: string            // free-form tag from the case's meta (overrides sourcePath)
}>
```

**Per-area app chrome.** A consuming app's decorator can render a page the way it
looks in the real app — inside its actual navigation/layout — by branching on
these:

Say a consuming app has two areas — a `marketing` site and the signed-in `app` —
each with its own header. A decorator can wrap page/flow cases in the matching
chrome and leave smaller components bare:

```tsx
function Decorator({ children, level, sourcePath, area }) {
  const inApp = level === 'page' || level === 'flow'
  // Resolve which chrome to use: an explicit `area` tag wins; otherwise infer
  // from the `page-cases/<area>/…` folder; otherwise render bare.
  const which =
    area ?? sourcePath?.match(/(?:^|\/)page-cases\/([^/]+)\//)?.[1]
  let content = children
  if (inApp && which === 'marketing') content = <SiteHeader variant="marketing">{children}</SiteHeader>
  else if (inApp && which === 'app') content = <SiteHeader variant="app">{children}</SiteHeader>
  return <Providers>{content}</Providers>
}
```

Cases tagged `marketing` (or under `page-cases/marketing/…`) render inside the
marketing header; `app` cases render inside the signed-in header.

Display Case is unopinionated here: it supplies the signals and mandates no
vocabulary or folder layout. Tag a case via `meta.area` (see
[Writing cases](writing-cases.md)), or organize cases into area folders and read
`sourcePath` — whichever suits the package. Chrome that itself renders router
`<Link>`s (e.g. a nav bar) needs a router in context; if your nav uses a router,
provide a tiny in-memory router inside the chrome so the links resolve.

### `styleEngines`

For components styled by a **runtime CSS-in-JS** library — emotion (and therefore
**Material UI**), styled-components, and peers — that emit their CSS as a side
effect of rendering. A style engine collects that styling during the server
render and delivers it in the isolated `/render` and Primer documents **before
scripting**, so those surfaces are styled without executing scripts (no flash, and
chrome-free snapshots come back styled).

```ts
styleEngines: [emotionEngine]
```

Each engine is a factory invoked **once per render** for an isolated style store:

```ts
type StyleEngine = () => StyleCollector
interface StyleCollector {
  wrap(node: ReactNode): ReactNode      // provide the library's store (e.g. emotion CacheProvider)
  collect(renderedHtml: string): string // return the <head> style markup that render used
}
```

`styleEngines` (the server-side extractor) pairs with [`decorator`](#decorator)
(the client/SSR provider, e.g. a MUI `ThemeProvider`). Omit `styleEngines`
entirely and the documents are byte-identical to their engine-free form. The full
recipe — emotion/MUI flagship, styled-components, and when to use `globalStyles`
instead — is in [Style engines](style-engines.md).

### `baselineDir`

Where the visual-regression runner reads and writes baseline PNGs. Defaults to the gitignored cache at `.display-case/baselines` (local-only). Provide a path — relative to the package or absolute — to point at a committed directory and gate CI on shared baselines. See [Testing](testing.md#where-baselines-live).

```ts
baselineDir: 'baselines'          // committed, relative to the package
// or
baselineDir: '/abs/path/to/baselines'
```

### `providers`

The visual-regression backend is pluggable. `providers` lets you replace either half of it — the **driver** that opens a case render URL and captures it, the **diff** that compares a capture against its baseline, or both.

```ts
export default defineConfig({
  title: 'Display Case',
  roots: ['src/components/**/*.case.tsx'],
  providers: {
    driver: () => myDriver(),   // optional; default = built-in Playwright + axe
    diff: myDiff,               // optional; default = built-in pixelmatch/pngjs
  },
})
```

When `providers` is omitted (or a half is left unset), Display Case falls back to its built-in default for that half. The default is **lazy and optional**: the Playwright/axe driver and pixelmatch/pngjs diff are imported only when a default-backed `check --a11y`/`--visual` actually runs, so browsing, snapshotting, and `init` never need them. See [Testing](testing.md#the-default-backend-is-lazy-and-optional). Setting a custom provider replaces the default for that half and removes the need for those packages entirely.

The reference implementations are the built-ins themselves — [`src/checks/providers/playwright-driver.ts`](../src/checks/providers/playwright-driver.ts) and [`src/checks/providers/pixelmatch-diff.ts`](../src/checks/providers/pixelmatch-diff.ts). A custom provider need only satisfy the interface.

#### The `CaseContext` argument

Both providers receive the identity of the case being rendered, so an identity-aware provider can vary its behavior per case (a per-case tolerance, a name-keyed hosted service such as Percy or Chromatic, richer reporting). Pure providers simply ignore it.

```ts
interface CaseContext {
  componentId: string
  caseId: string
  theme: 'light' | 'dark'
  width: number
}
```

#### `diff`

```ts
type DiffFn = (
  input: { baseline: Uint8Array; actual: Uint8Array },
  ctx: CaseContext & { baselinePath: string },
) => DiffResult | Promise<DiffResult>

interface DiffResult {
  changed: boolean
  mismatch?: number       // e.g. count of differing pixels, for reporting
  diffImage?: Uint8Array  // written next to the baseline on a change
}
```

A custom diff that loosens tolerance for one noisy case and leaves every other case strict:

```ts
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'
import { defineConfig, type DiffFn } from '@awarebydefault/display-case'

const tolerantDiff: DiffFn = ({ baseline, actual }, ctx) => {
  const a = PNG.sync.read(Buffer.from(baseline))
  const b = PNG.sync.read(Buffer.from(actual))
  if (a.width !== b.width || a.height !== b.height) return { changed: true }
  // Allow a few stray pixels on the gradient case; everything else stays exact.
  const allowed = ctx.caseId === 'gradient' ? 50 : 0
  const diff = new PNG({ width: a.width, height: a.height })
  const mismatch = pixelmatch(a.data, b.data, diff.data, a.width, a.height, {
    threshold: 0.1,
  })
  return mismatch > allowed
    ? { changed: true, mismatch, diffImage: PNG.sync.write(diff) }
    : { changed: false, mismatch }
}

export default defineConfig({
  title: 'Display Case',
  roots: ['src/components/**/*.case.tsx'],
  providers: { diff: tolerantDiff },
})
```

#### `driver`

```ts
interface RenderDriver {
  open(url: string, ctx: CaseContext): Promise<RenderedPage>
  close(): Promise<void>
}

interface RenderedPage {
  screenshot(): Promise<Uint8Array>
  audit(): Promise<A11yViolation[]>  // [] if the driver skips auditing
  dispose(): Promise<void>
}

interface A11yViolation {
  id: string
  help: string
  nodes: number
}
```

`driver` is a factory: it is called once, returns a `RenderDriver` reused across every case, and `close()` runs when the check finishes. Each `open()` yields a `RenderedPage` you can `screenshot()` and `audit()`, then `dispose()`. A sketch:

```ts
import { defineConfig, type RenderDriver } from '@awarebydefault/display-case'

function myDriver(): RenderDriver {
  const browser = /* launch your headless browser once */
  return {
    async open(url, ctx) {
      const page = /* open `url`; ctx.theme / ctx.width are already in the URL */
      return {
        screenshot: () => page.capture(),
        audit: async () => [],        // return [] to skip a11y auditing
        dispose: () => page.close(),
      }
    },
    close: () => browser.close(),
  }
}

export default defineConfig({
  title: 'Display Case',
  roots: ['src/components/**/*.case.tsx'],
  providers: { driver: myDriver },
})
```

Compare against the built-in [`createPlaywrightDriver`](../src/checks/providers/playwright-driver.ts), which launches Chromium at a fixed 1024×768 viewport with reduced motion and runs a WCAG 2 A/AA axe audit.

### `check`

Tunes the `check` command. Two independent parts:

```ts
check: {
  // Which phases run in the default (no-flag) run. Unset ⇒ included; set false to
  // opt out. An opted-out phase still runs when named explicitly (e.g. --visual).
  defaultPhases: { visual: false },

  structure: {
    // Treat every structure warning as an error for the run (same as --strict).
    strict: false,
    // Per-rule overrides. Each rule is on at its default severity unless set here.
    rules: {
      'primer-present-and-used': false,        // disable a rule
      'composes-lower-level': 'error',          // enable/retune severity
      'case-placard-coverage': { ignore: ['**/internal/**'] }, // skip paths
      'atom-purity': {},                        // enable an opt-in rule at default severity
      'level-fit': { thresholds: { molecule: 8 } }, // rule-specific options
    },
  },
}
```

- **`defaultPhases`** — a `Partial<Record<'tokens' | 'a11y' | 'visual' | 'structure', boolean>>`. Drop a phase from the bare `check` run (e.g. `visual` when no baselines are committed) while keeping it available via its flag.
- **`structure.rules[id]`** — `false` disables the rule; `'warn'`/`'error'` enables it at that severity; an options object (`{ severity?, ignore?, thresholds? }`) enables it with overrides. Unset ⇒ the rule's default. The rule ids, defaults, and escape-hatch markers are listed in [Testing → Structure checks](testing.md#structure-checks).
- **`structure.strict`** — escalate all structure warnings to errors (the config equivalent of `check --strict`).

### `a11y`

Surface accessibility results **in the running browse chrome** — a per-variant
marker in the nav rail and an Accessibility panel beside the rendered case.

```ts
a11y: {
  enabled: true,                 // default false — opt-in
  themes: ['light', 'dark'],     // default both; scanned + reflected per theme
  exclude: ['color-contrast'],   // axe rule ids to skip
  startup: 'cached',             // default 'off' — how the nav is populated at boot
}
```

- **Off by default.** It needs the same optional Playwright + axe toolchain as a
  default-backed `check` (see [`providers`](#providers)); when that toolchain
  can't launch, the panel shows an *unavailable* state and the server still
  browses normally — it never fails to start.
- **On demand + cached.** Only the variant you're viewing is scanned, lazily;
  results are cached under `.display-case/a11y/` and reused until that variant's
  rendered output changes (judged by a transitive-import content hash). Scans run
  on a background queue and never block browsing.
- **`startup` populates the nav at boot** (only meaningful with `enabled`; default
  `'off'`). It does not change the on-demand-per-viewed-variant behavior — it only
  decides what the nav shows *before* you start clicking:
  - `'off'` — no boot-time population; a variant's marker appears only once viewed.
  - `'cached'` — fill markers from reusable cached results, running **no** scans;
    uncached or stale variants stay unmarked until viewed.
  - `'refresh'` — additionally scan every uncached or stale variant at boot,
    surfacing each verdict as it lands (reusing fresh cache without re-scanning).
    Work rides the same background queue, so browsing stays responsive. Nothing is
    scanned if the toolchain can't launch.
- **`enabled` gates only the live surface.** The `display-case check --a11y` CI
  gate runs whenever invoked regardless of `enabled`, but honors the shared
  `themes` / `exclude` here so the panel and the gate agree on what counts as a
  violation.

## The cache directory

Display Case writes generated artifacts (the bundled output and the auto-generated render entry) to `.display-case/` inside the package, and — unless overridden — keeps baselines under `.display-case/baselines/`. Add `.display-case/` to `.gitignore`; it is a derived cache.
