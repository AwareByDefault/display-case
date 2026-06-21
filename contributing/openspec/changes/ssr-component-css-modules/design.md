## Context

The Vitrine design-system components (`src/ui/design-system/`) each declare a
`const CSS` template literal and call `injectStyle(id, CSS)` at module load.
`injectStyle` appends a `<style>` to `document.head` and **no-ops under Node**
(`typeof document === 'undefined'`). Consequences:

- Server-rendered documents (`render/documents.ts`, `server/server.ts`,
  `server/prod-server.ts`) inline only `tokensCss + globalCss + reset +
  chromeCss`. `chrome.css` is *shell layout only* — it explicitly excludes the
  `dcui-*` component appearance (see `chrome.css` header comments). So component
  styling is absent from first paint and only arrives once the browser bundle
  executes the module-load `injectStyle` calls → flash of unstyled content.
- The chrome-free `/render` document is the worst case: a snapshot fetched
  without running scripts comes back unstyled, undermining the
  machine-readable-snapshot guarantee.
- Styling depends on import order and a runtime DOM mutation — non-deterministic
  and invisible to anything that reads HTML without executing JS.

Today's inlining model is the anchor: `chrome.css` is read once with
`Bun.file(CHROME_CSS).text()` and concatenated into the head `<style>`, and
re-read on change (`server.ts:899`). The fix should slot component CSS into that
same model rather than invent a parallel one.

## Goals / Non-Goals

**Goals:**

- Component CSS is part of every server-rendered document's head, before
  scripts, deterministically — shell, isolated render, and primer; in dev,
  prod-server, and `publish` (including `--static`).
- CSS stays co-located with each component (a sibling file), authored as plain
  CSS, bundled by Bun. Zero client-side style injection; zero new dependency.
- Remove `inject-style.ts` and the `*.css` text-import declaration once unused.
- No change to class names, markup, public exports, or consuming-app coupling.

**Non-Goals:**

- CSS Modules *scoping* (scoped hashed class names). Out of scope — see Decision 1.
- A CSS-in-TS toolchain (Vanilla Extract / Linaria) or any build plugin.
- Reworking the tokens (`colors/typography/spacing.css`) or `chrome.css`
  layout mechanism — only the per-component appearance CSS moves.
- Switching from inlined `<style>` to content-hashed `<link>` assets (a possible
  later optimization for `publish`; not required here).

## Decisions

### 1. Plain co-located `.css` files, not CSS Modules

Each component gets a sibling stylesheet (`Button.tsx` → `Button.css`) holding
exactly today's `const CSS` body, imported for its side-effect on the bundle
graph: `import './Button.css'`. The existing manual `dcui-*` / `dcpl-*`
namespaces are kept verbatim.

- **Why not CSS Modules (`.module.css`):** the components select on hand-written
  class names *and* attribute selectors (`.dcui-btn[data-variant="primary"]`,
  `[aria-pressed="true"]`, descendant combinators). Module scoping rewrites only
  the leading class, forcing every component to import a `styles` object, thread
  `styles.btn` into `className`, and leaving attribute/state selectors and
  cross-element rules awkward. The namespaces already prevent collisions, so
  scoping buys little for a large, mechanical rewrite. Rejected for churn and
  selector friction.
- **Why not keep the template literal but collect it server-side** (a tiny SSR
  style registry — Option 1 from the investigation): viable and lower-churn, but
  keeps a bespoke runtime mechanism and an import-order contract. Moving CSS to
  real files makes it the bundler's job, which is the project's "let Bun do it"
  grain. This proposal deliberately takes the files route.

### 2. One aggregated component stylesheet, inlined like `chrome.css`

Bun's bundler, following the component `.css` imports from the browser entry,
emits the component CSS. We surface it to the document builders as a single
`componentsCss` string and inline it into the head `<style>` next to the
existing slots: `tokensCss + globalCss + reset + chromeCss + componentsCss`.

- The browser entry **no longer injects** anything; all styling lives in the
  head. This keeps the "render before scripts" guarantee literally true.
- Inlining (not `<link>`) matches `chrome.css` today, so dev and
  `publish --static` behave identically with no extra request and no asset-order
  race.
- Determinism: the aggregate is assembled in a stable, sorted import order
  (e.g. a generated/maintained barrel that imports each component CSS) so rule
  cascade order never depends on discovery or filesystem iteration.
- All three documents get the slot: `buildShellDocument`, `buildRenderDocument`
  (the chrome-free `/render` — which previously inlined almost nothing), and
  `buildPrimerDocument`, in both `documents.ts` and the prod/publish builders.

### 3. Server import of `.css` must be side-effect-free, not fatal

The codegen'd SSR entry imports case modules → design-system components → their
`.css`. Under `renderToString` (Node/Bun runtime, not the bundler) those `.css`
imports must **not throw**; the actual CSS is delivered via the inlined
aggregate, so the server-side import only needs to resolve to a harmless no-op.
The implementation MUST confirm Bun resolves a bare `import './x.css'` to an
empty/no-op module in the run/test runtime (or configure a loader that makes it
so) before mass-migrating. This is the single most load-bearing unknown and is
validated first (see Migration Plan step 0).

### 4. Live-reload watches `.css`

Today editing a component's CSS string reloads the module and re-injects.
Afterward, the watch set must include the new `.css` files and rebuild the
`componentsCss` aggregate on change — mirroring the existing chrome.css re-read
(`server.ts:899`). Editing a `.css` triggers a CSS rebuild + live-reload, not a
full SSR bundle rebuild where avoidable.

## Risks / Trade-offs

- **Bun runtime `.css` import behavior under SSR/test** → If a bare `.css`
  import throws or pulls content during `renderToString`, the SSR path breaks.
  *Mitigation:* validate in a one-component spike first (Migration step 0); fall
  back to retaining the `{ type: 'text' }` import attribute (and an aggregate
  built by concatenating those texts) if the bare import is not no-op.
- **Cascade ordering across 22 sheets** → Merging per-component CSS into one
  sheet could change specificity outcomes if order shifts. *Mitigation:* fixed
  sorted import order in the aggregate; visual-regression check over the
  showcase before/after to catch any drift.
- **Larger inlined HTML** (component CSS now in every document head) vs a cached
  `<link>` → *Mitigation:* matches the current `chrome.css` trade-off and is
  modest; a content-hashed `<link>` for `publish` is a later, separate option.
- **Mechanical rewrite scope (22 + primer-specimen)** → many files touched.
  *Mitigation:* the change is purely an extract-and-import per file with no logic
  change; do it component-by-component behind the validated spike, gated by the
  SSR check and e2e chrome suite.

## Migration Plan

0. **Spike (decision-gating):** convert one component (e.g. `Button`) to a
   co-located `.css` + import; wire a single `componentsCss` slot into the
   render + shell documents; confirm (a) the server-side import does not throw
   under `renderToString`, (b) `/render` HTML is styled with scripts disabled,
   (c) live-reload of the `.css` works. Resolve Decision 3's loader question here.
1. Add the aggregate stylesheet plumbing and the `componentsCss` slot to all
   three document builders (dev + prod/publish).
2. Migrate the remaining design-system components and `primer-specimen/styles.ts`
   mechanically: CSS body → sibling `.css`, replace `injectStyle(...)` with
   `import './X.css'`.
3. Delete `inject-style.ts` and `src/types/css-text.d.ts` once no references
   remain; update `primer.tsx` (its own `injectStyle` call) the same way.
4. Update live-reload watch set for `.css`.
5. Docs: design-system README (the self-contained-styling section now describes
   co-located CSS files), `contributing/NOTES.md`, and
   `contributing/coding-best-practices.md` (new convention: component CSS is a
   co-located bundled file, never runtime-injected).
6. Verify: `bun run check --ssr` (now meaningfully covers styling presence),
   `bun run e2e`, and the visual-regression review for cascade drift.

**Rollback:** the change is additive until step 3; reverting the commits
restores `injectStyle`. No data or persisted state is involved.

## Open Questions

- Does Bun's run/test runtime treat a bare `import './x.css'` as a no-op module,
  or is the `{ type: 'text' }` attribute (or a loader stub) required? Resolved in
  Migration step 0; design assumes the fallback is cheap either way.
- Should the aggregate be a hand-maintained barrel or generated from discovery?
  Lean barrel for determinism and simplicity; revisit only if component churn
  makes manual maintenance noisy.
