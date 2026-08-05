# Design — Pluggable Rendering Substrate

> Source: [issue #42](https://github.com/AwareByDefault/display-case/issues/42)
> (body + follow-up comment). The comment's code-traced answers to the open
> questions are adopted here as decisions D2–D7; the comment's three additions
> are D8–D10.

## Context

Display Case's pipeline is substrate-neutral in intent but DOM-bound in one
layer. The seam is already correct:

- `src/index.ts` (authoring API) and `src/render/render-node.tsx`
  (`caseTree()`, `resolveTweaks()`, `encodeOverrides()`) are DOM-free by
  documented contract. `caseTree()` turns *(case module, caseId, tweaks, flow
  state)* into a renderer-agnostic React element.
- The DOM assumption enters one step later: `react-dom/server` in
  `ssr-render.tsx` / `ssr-shell.tsx` / `ssr-primer.tsx`, the browser bundle in
  `server/build-case.ts` + `build-runner.ts`, the mount/hydration in
  `ui/render-mount.tsx` / `browser-entry.tsx`, and the DOM-shaped checks
  (`ssr-check`, `tokens-check`, `a11y-scanner` + Playwright driver,
  pixelmatch).
- The chrome already talks to the stage only through an `<iframe>` at a fixed
  render address (`src/ui/shell.tsx`) plus a postMessage protocol
  (`dc-render` / ready / `dc-step-changed`). The chrome never touches the
  stage's DOM.
- `SnapshotProviders` (`driver` + `diff`) is existing precedent for a pluggable
  render backend; this design generalizes that idea from "how do we screenshot
  it" to "how do we render it at all".

The motivating second implementation is Carte (concurrent React renderer for
terminals): cases render server-side to a cell grid and ANSI bytes; the stage
paints them with a web-embedded terminal emulator (xterm.js or equivalent)
while the entire browsing chrome stays as-is. Cases are **not** portable across
substrates (Carte rejects `div` at reconciliation); what is shared is the
format, discovery, chrome, checks, publish pipeline, and agent skills. A
showcase targets exactly one substrate.

## Goals / Non-Goals

**Goals:**

- A `substrate` config key whose default (`domSubstrate()`) reproduces today's
  behavior byte-for-byte — the extraction must be reviewable as a no-op.
- A substrate implementable out-of-tree in ordinary TypeScript against a
  stable public entry point, without importing `src/` internals.
- Variant axes, check phases, baselines, stage document, and stage runtime all
  substrate-supplied.
- The agent story preserved or improved: manifest enumeration, deterministic
  render addresses, and a browserless `display-case render` capture path.

**Non-Goals:**

- Making the browsing chrome substrate-agnostic — the chrome (`src/ui/`,
  the Vitrine) stays a DOM application.
- Shipping any Carte dependency from this package; the Carte substrate lives
  on the Carte side and is wired in through config.
- Multi-substrate showcases in a single package.
- Replacing `Bun.serve` or Bun-native bundling.
- Interactive non-DOM cases (key input routed into a live instance) — see D3;
  v1 of a non-DOM stage is static frames per variant/tweak combination.
- An ANSI→HTML pre-paint for a static first frame — worth evaluating later,
  explicitly not gating v1.

## Decisions

### D1 — The `Substrate` interface

Pinned shape (names final unless review says otherwise; `Frame` is the
substrate's opaque render product):

```ts
export interface Substrate<Frame = unknown> {
  /** Stable id: cache keys, the baseline path segment, the manifest. `'dom'`
   *  for the default substrate. */
  id: string

  /** The axes this substrate varies over, replacing hard-coded light/dark +
   *  px viewports. See D6. */
  variants: SubstrateVariantAxis[]

  /** Render a case tree headlessly — no browser, no DOM. Used by the
   *  pre-script render, the render endpoint, checks, publish, and the CLI
   *  render subcommand. */
  render(tree: ReactNode, ctx: SubstrateRenderContext): Promise<Frame>

  /** Serialize a frame for transport, baselines, and stdout. `ext` names the
   *  baseline file extension (`html`, `txt`, `ansi`, …). */
  serialize(frame: Frame): { bytes: Uint8Array; ext: string }

  /** Produce the ENTIRE stage document served at the render address (see D2).
   *  Today's `renderDoc()` becomes the DOM implementation. */
  document(frame: Frame, ctx: SubstrateDocumentContext): string

  /** Client runtime that paints/hydrates a frame inside the stage document.
   *  `entry` is a module specifier the per-component bundle includes; `share`
   *  lists specifiers merged into the consumer's `share` for publish (see D5).
   *  Omitted ⇒ the frame is static and needs no client script. */
  stage?: { entry: string; share?: string[] }

  /** Substrate-appropriate check phases (see D4, D8). Each omitted member
   *  marks that phase inapplicable for this substrate. */
  checks?: {
    /** Generalizes the ssr check: "renders headlessly without throwing". */
    safety?(tree: ReactNode, ctx: CaseContext): Promise<CheckFinding[]>
    /** Generalizes axe: layout overflow / truncation / SGR contrast for a
     *  terminal substrate. */
    audit?(frame: Frame, ctx: CaseContext): Promise<A11yViolation[]>
    /** Capture bytes for the visual phase. Default: `serialize(render(...))`
     *  — headless, no server, no browser. The DOM substrate overrides it with
     *  the browser-driver flow (see D4). */
    capture?(target: CaptureTarget, ctx: CaseContext): Promise<Uint8Array>
    /** Default diff for captured bytes; `config.providers.diff` wins (D4). */
    diff?: DiffFn
    /** Token-vocabulary conformance for this substrate's style system. */
    tokens?(ctx: TokensContext): Promise<CheckFinding[]>
  }

  /** Optional display relabelling of the fixed hierarchy taxonomy (D7),
   *  e.g. page → "Screens". Keys are the existing `HierarchyLevel` set. */
  levelLabels?: Partial<Record<HierarchyLevel | 'unclassified', string>>
}
```

`DisplayCaseConfig` gains `substrate?: Substrate`, defaulting to
`domSubstrate()`. Substrate-specific options arrive through the factory
(`domSubstrate({...})`, `carteSubstrate({ viewport: { cols: 80, rows: 24 } })`),
not through new top-level config keys. Existing top-level DOM-shaped keys
(`globalStyles`, `styleEngines`, `theme`, `a11y.themes`, `providers`) remain
public API and are routed into the DOM substrate; a non-DOM substrate ignores
them (the structure check SHOULD warn when they're set alongside a substrate
that doesn't consume them).

**Why this shape over alternatives:** a single object (vs. separate
`renderer`/`stage`/`checks` config keys) keeps the invariant that a showcase
targets one substrate and lets an implementor version the whole contract
together. `Frame` stays generic rather than a required record shape so the
core never learns substrate internals — see D10.

### D2 — The substrate owns the *whole* stage document

The seam is the iframe, not an inner element: `src/ui/shell.tsx:31` embeds the
stage as an `<iframe>` and everything after that is postMessage. The document
envelope is where the DOM assumptions actually live — `renderDoc()` in
`src/render/documents.ts` owns `color-scheme`, the theme signals on `<html>`
(`themeRootAttrs`), `globalStyles`, the Vitrine stylesheet,
`data-decorated`/transparent background, `fit`, and the importmap. A terminal
substrate must drop nearly all of that and supply its own (monospace stack,
cell metrics, no body background). If the substrate owned only an inner
element, every one of those DOM-only invariants would stay mandatory.

So `substrate.document(frame, ctx)` produces the full document, and today's
`renderDoc()` moves into `domSubstrate()`. The chrome's dependency surface
shrinks to exactly two contracts, both promoted from implicit
(`render-mount.tsx`, `use-shell.ts`) to spec-pinned:

1. the render address shape — `/render/<component>/<case>?…` with
   variant/tweak/flow-step parameters, and
2. the stage message protocol — the `dc-render` request, the stage-ready
   acknowledgement, and `dc-step-changed` flow-step notifications.

### D3 — Interactivity: client-hosted; v1 ships static frames only

Rejected: a socket back to a live server-side instance (the Carte-devtools
shape). It introduces per-connection server state, and it breaks
`publish --static` outright — a server-less export has nothing to hold the
live instance. "No dev machinery in the build" is a stated core principle, and
a devtools-style socket is exactly that.

Chosen: the same shape the DOM path already has — server render produces the
pre-script paint, then `stage.entry` re-mounts a live instance client-side
(the DOM substrate's `stage.entry` is today's mount/hydration). For Carte
that requires a DOM-hosted headless mode, which is on the Carte side of the
line.

Static-only v1 is genuinely useful, not a stub: the tweak map is URL-encoded
(`resolveTweaks` / `encodeOverrides`), so the tweaks panel already works by
re-rendering from the address. A static frame per tweak/variant combination
keeps the whole tweaks/flows/deep-link surface functional. The `stage` member
being optional encodes this: a substrate without a client runtime is a valid,
complete substrate.

### D4 — `SnapshotProviders` splits: `diff` folds in, `driver` demotes

`RenderDriver.open(url, ctx)` is irreducibly browser-shaped (`check.ts`
boots a server, opens a URL, screenshots, runs axe). A text substrate has no
driver — `render()` + `serialize()` *is* the capture, with no server and no
browser in the loop. `DiffFn` by contrast is already substrate-neutral
(`Uint8Array` in, changed-or-not out) and a consumer may legitimately want to
override it independently of the substrate (hosted diff service, per-case
tolerance).

Layering:

- capture becomes `substrate.checks.capture`, defaulting to
  `serialize(render(...))`;
- the DOM substrate implements `capture` via its browser driver, which becomes
  a **DOM-substrate option** (`domSubstrate({ driver })`);
- `substrate.checks.diff` supplies the default diff;
- top-level `config.providers` survives as an explicit consumer override that
  wins over the substrate;
- `providers.driver` stays accepted as a **deprecated alias** routed into the
  DOM substrate's options — it's public API (`src/index.ts`), it must not
  vanish.

Side benefit: once capture doesn't require a server, the `display-case render`
subcommand is nearly free, and a text substrate's check path drops the HTTP
server and browser entirely.

### D5 — `share` / importmap: unchanged; substrates declare their own entries

`share` is a publish-time bundler concern (`externalExact` in
`build-case.ts`): externalize exact specifiers, build one content-hashed
vendor bundle, resolve via the importmap in `documents.ts`. It is indifferent
to *who* imports the specifier — and since `stage.entry` gets bundled into
every per-component render bundle, an emulator like xterm.js is precisely the
N-copies case `share` exists to collapse.

Two changes: `stage.share` lets a substrate declare its own shared specifiers,
merged into the consumer's `share` list, so its client runtime is vendored
once without the consumer knowing its dependency names. And the always-shared
React runtime becomes substrate-declared rather than hard-coded (the DOM
substrate declares `react`/`react-dom`; a non-React stage runtime isn't forced
to pull it).

### D6 — Variant axes replace theme + viewport; baselines become substrate-keyed

**Axes.** `SubstrateVariantAxis` declares `{ id, label, values, default }` and
one of two kinds:

- `render` — encoded in the render address, consumed server-side by
  `substrate.render()` (DOM: `theme`; Carte: `cols×rows` size presets, color
  capability truecolor/256/16/`NO_COLOR`, unicode vs ASCII box drawing);
- `stage` — applied by the chrome around the stage without a re-render (DOM:
  the px viewport width / `DEVICES` / `RESPONSIVE` presets from
  `shell-core.ts`, which constrain the iframe, not the document).

The chrome's theme/viewport controls generalize to render whatever axes the
active substrate declares; check enumeration and the manifest iterate the
`render`-kind axes. Light/dark is thus not special-cased anywhere outside
`domSubstrate()`. The `a11y.themes` config narrows which axis values the
audit runs under and stays DOM-compat as-is.

**Baselines.** Today: `<baselineDir>/<component>/<case>.<theme>.png`
(`check.ts`) — theme baked in, `.png` hard-coded, no substrate segment.
Switching substrates would silently invalidate everything, and text baselines
would land as `.png`, unreadable in PR diffs. New layout:

```
<baselineDir>/<substrate.id>/<component>/<case>.<variantKey>.<ext>
```

`variantKey` is a deterministic join over the substrate's `render`-axis values
(DOM: `light` / `dark`, unchanged in spirit); `ext` comes from `serialize()`.
Text frames diff *better* than PNGs — deterministic under a manual frame
clock, reviewable in a PR diff.

**Migration:** the DOM substrate's id is `dom`; `baselineDir` defaults to the
gitignored `.display-case/baselines` cache, so most consumers just
regenerate. For a committed baseline dir, the DOM substrate tolerates the
legacy flat path for one release: it reads
`<component>/<case>.<theme>.png` when the keyed path is missing, always writes
the keyed path, and prints a one-line migration hint.

### D7 — The hierarchy taxonomy stays fixed; only display labels are substrate-supplied

`level` is not DOM vocabulary — it's a composition taxonomy, load-bearing far
past cosmetics: `HIERARCHY_LEVELS`/`isSurfaceLevel` in `index.ts`, manifest
grouping, the Components-vs-Exhibits mode split, and four structure rules
(`atom-purity`, `no-downward-dependency`, `composes-lower-level`, `level-fit`
with per-level thresholds). A terminal UI has atoms, molecules, and screens in
exactly the same sense. Letting a substrate define its own level set would
fork every structure rule and the `level-fit` defaults — a large bill for a
vocabulary preference.

Relabelling is cheap and sufficient: `LEVEL_LABEL` in `shell-core.ts` is a
flat map; `substrate.levelLabels` overlays it (e.g. "Pages" → "Screens").

### D8 — The `--ssr` flag: `--safety` becomes canonical, `--ssr` stays a permanent alias

`--ssr` is a user-facing flag name referenced in the docs, the git hooks, and
`bun run check` — not just an internal phase. The honest generalization of the
phase is "renders headlessly without throwing" (`substrate.checks.safety`).
The CLI gains `--safety` as the substrate-neutral canonical flag; `--ssr`
remains a supported alias with no removal horizon (for the DOM substrate it is
the accurate name). `check`-config phase names accept both spellings; this
repo's own scripts, hooks, and docs move to `--safety`.

Relatedly, `browserOnly` (the per-component headless-render opt-out) keeps its
public name — the core reinterprets it as "cannot render headlessly; only the
stage runtime can paint it", which is substrate-neutral in meaning. No new
authoring-API name in this change.

### D9 — Variant generalization reaches the e2e suite deliberately

`theme` is not only in URLs and the manifest — it's in `src/ui/test-ids.ts`
and the Playwright chrome suite's locators. The variant-axes step is therefore
sized to include: chrome controls rendered from declared axes, `test-ids`
keyed by axis id + value rather than hard-coded light/dark, and the e2e suite
updated against the DOM substrate's declared axes (which keep today's ids, so
locator churn is mechanical, not behavioral).

### D10 — `Frame` is opaque to the core; `headStyles` becomes a DOM-frame field

`CaseHtmlResult.headStyles` (style-engine output) currently threads through
`ssr-render` into all three documents. Under the substrate split, the DOM
substrate's frame type is `{ html, headStyles, browserOnly, error }` —
`collect-styles.ts` and the `styleEngines` config surface move wholly inside
`domSubstrate()`, and the core never sees `headStyles`. The core handles only
`Frame` (opaque), `serialize()` bytes, and `document()` strings. This is the
decision that keeps the `Substrate` type honest: if the core needed a field on
`Frame`, the abstraction would be leaking.

### D11 — The substrate-neutral core ships as a real subpath export

Today's exports are only `.`, `./tokens-check`, and `./prod-server`, so a
substrate implementor would have to reach into `src/` internals. New subpath
`@awarebydefault/display-case/core` covering: the authoring API re-exports it
needs, `core/discovery`, `core/catalog`, `core/manifest`, `core/groups`,
`render/render-node`, and the `Substrate` contract types. The export is
independently useful (it unblocks out-of-tree work immediately) and lands
first. The substrate contract is documented **experimental** until the first
out-of-tree substrate (Carte) has validated it — the interface should survive
contact with a real second implementation before it's declared stable.

### D12 — `display-case render <component>/<case>` prints a serialized frame

New CLI subcommand: resolve config, render headlessly via the substrate,
serialize, write bytes to stdout (`--variant k=v` repeatable; defaults from
the axis declarations; `--out <file>` optional). For a text substrate this is
strictly better than the HTTP endpoint for agents — no server, no browser, no
vision model: the frame is directly readable. For the DOM substrate it prints
the chrome-free pre-rendered document (the render endpoint's document, minus
the server). The bundled skills (`display-case-snapshot`,
`display-case-review`) get their capture step redirected through this and the
manifest needs no change.

## Risks / Trade-offs

- **[The no-op extraction (DOM path → `domSubstrate()`) regresses silently]**
  → acceptance criteria pinned in tasks: rendered documents byte-identical for
  a default-config showcase, full unit + e2e suites pass unchanged, and the
  repo's own dogfooded showcase diffed before/after. This step is where the
  design risk lives; it lands before any generalization.
- **[The interface is wrong in ways only a second implementation reveals]** →
  the contract ships experimental (D11); Carte is built out-of-tree against it
  (issue step 5) before the `Substrate` type is declared stable. Breaking the
  experimental contract is allowed between minors until then.
- **[Baseline re-keying invalidates committed baselines]** → one-release
  legacy-path read tolerance in the DOM substrate + migration hint (D6);
  default-cache consumers regenerate automatically.
- **[Variant generalization churns the e2e suite]** → DOM substrate keeps
  today's axis ids/values, so locator updates are mechanical (D9); the chrome
  keeps `src/ui/test-ids.ts` as the single locator vocabulary.
- **[Public-surface growth on a deliberately small export map]** → one new
  subpath (`./core`), everything else additive on existing entry points;
  `providers.driver` deprecated-but-accepted rather than removed.
- **[DOM-only config keys become confusing under a non-DOM substrate]** →
  routed to the DOM substrate and warned about by the structure check when
  inert (D1); no key is removed or renamed.

## Migration Plan

1. Existing consumers: no action. No `substrate` key ⇒ `domSubstrate()` with
   today's behavior and today's baseline paths tolerated (one release).
2. `providers.driver` users: works unchanged; deprecation note points at
   `domSubstrate({ driver })`.
3. Committed-baseline users: re-record (`--update`) into the keyed layout, or
   rely on the legacy tolerance until the next minor.
4. This repo: `bun run check`, hooks, and docs move `--ssr` → `--safety`
   (alias keeps external users unbroken).
5. Rollback: the substrate seam is additive; reverting to the pre-seam
   renderer is a revert of the extraction commits, with no data migration
   (baselines regenerate).

## Open Questions

- ANSI→HTML pre-paint for a static first frame in the terminal stage —
  evaluate after v1; not gating (D3).
- Interactive input routing for non-DOM substrates (key events → live
  client-hosted instance) — deferred to the Carte-side work; the contract
  reserves `stage.entry` as the hook and adds nothing else yet.
- Whether the tokens phase gains a real non-DOM implementation (e.g. a
  terminal palette vocabulary) or non-DOM substrates simply mark it
  inapplicable at first — decided when Carte's substrate lands out-of-tree.
