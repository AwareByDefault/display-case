## Context

Display Case (`packages/display-case/`) already runs accessibility audits, but
only through the `check` CLI subcommand: it boots a throwaway server, drives
Playwright + axe-core over each `/render/<component>/<case>?theme=…`, prints
violations to stderr, and exits non-zero to gate CI (`src/check.ts`,
`src/cli.ts`, `src/providers/playwright-driver.ts`). The browse server
(`display-case .`) never runs axe, and `useShell()` leaves the `a11y` field on
the view model undefined — the nav markers and Accessibility panel that already
exist in `ShellView.tsx` are, today, fed only by static page-case fixtures.

A real `check --a11y` run over Display Case itself produced **101 violations**:
83 `color-contrast`, 12 `select-name`, 6 `label`; spread across `component ×
case × theme` (52 dark, 49 light, several theme-specific); 1–18 nodes per
violation. axe also returns an `impact` (minor/moderate/serious/critical) that
the current `A11yViolation` shape (`{ id, help, nodes }`) drops. This is the
empirical basis for the design: contrast-dominated, theme-sensitive,
high-node-count, and worth ordering by severity.

Verified mechanics this design builds on:
- Config flows `resolveConfig → startDisplayCase → rebuild` already carrying the
  whole `DisplayCaseConfig` (`server.ts:406-417`); adding a field needs no new
  plumbing.
- Live reload is an SSE endpoint `/__livereload` registered **only** in `--dev`,
  doing a full `location.reload()` (`server.ts:249-260, 449`). The non-dev
  watcher matches `*.case.tsx|prompt.md|mdx`; `--dev` broadens to
  `*.ts/tsx/css` (`server.ts:549`).
- The stage iframe loads `/render/<c>/<cs>` once (`use-shell.ts` `frameSrc`,
  `shell.tsx`); case/theme/tweak swaps happen in place via `postMessage`
  (`dc-ready` / `dc-render`, `render-mount.tsx`).
- `Bun.build` currently reads only `result.success` — no metafile/import graph
  captured (`server.ts:177-197`). Cache dir is `.display-case/` (`discovery.ts`
  `cacheDir`).

## Goals / Non-Goals

**Goals:**
- Feed real audit results into the existing nav markers + Accessibility panel,
  on the running browse server, behind an opt-in config flag.
- Keep scanning optional: the Playwright/axe toolchain is lazily loaded and
  never required to start or browse.
- Scan as little as possible: on-demand for the viewed variant, results cached
  on disk and reused until the variant's rendered output changes.
- Never block: request handling, bundling, and the iframe are independent of any
  scan in flight.
- Make the local run loop tight: component-source edits update the rendered
  iframe in place and re-trigger that variant's scan.

**Non-Goals:**
- The static, host-able `build` mode (named as future direction only).
- Auto-fixing violations or editing component source.
- Scanning tweaked (non-default) variant states; the canonical audit is the
  default render per theme (matches `check`).
- Git-based change detection (evaluated and rejected — see Decisions).

## Decisions

### 1. Opt-in config, graceful degradation
Add an optional `a11y` block to `DisplayCaseConfig` (`src/index.ts`):
`{ enabled?: boolean (default false); themes?: ('light'|'dark')[]; exclude?:
string[] }`. The browse server reads `config.a11y` in `rebuild`/serve. The
Playwright driver is imported lazily on the first scan; a missing-browser error
is caught and flips the surface to an `unavailable` state — the server must boot
and browse without the toolchain. **Why opt-in/default-off:** Playwright is not
an assumed dependency of a component showcase; forcing it on every consumer is
hostile. Alternative (auto-enable when Playwright is resolvable) rejected as too
implicit.

### 2. Async scanner: one reused browser + serial queue
A scanner module owns a single lazily-launched browser (reused across scans,
like `check.ts` reuses its driver) and a serial job queue. Selecting a variant
posts a scan request; the server replies immediately with the cached result or
`pending` and enqueues a job. Completion pushes the result to the browser (SSE,
see #5). The scan opens `/render/<c>/<cs>?theme=…` in its **own** background
page, never the user's iframe. **Why serial + one browser:** axe runs are heavy
(hundreds of ms–seconds); a keystroke-frequency or per-request launch would
thrash. Debounce rapid re-requests; prioritize the viewed variant.

### 3. Cache keyed by per-variant transitive content hash
Persist results under `.display-case/a11y/` as one JSON per
`component/case/theme`, each storing `{ hash, impact-bearing violations,
scannedAt }`. The `hash` is over the variant's transitive input set: the
`.case.tsx`, its resolved component imports (crawled from the case file), plus
shared inputs (global styles, tokens, the render chrome, decorator). Validity
check is layered: **stat (mtime+size) first** (no reads), **content-hash only
when stat changed** (avoids re-scan on touch-without-change). **Why content hash
over the bundle:** the render bundle is one entrypoint for all cases, so its hash
is too coarse (any edit invalidates everything). A per-case import crawl gives
precise invalidation. Over-invalidation (a comment edit re-scans) is the safe
direction; under-invalidation is not.

### 4. No git-based detection
Considered `git status`/`diff` as a fast "what changed" filter. Rejected: it only
sees tracked files, isn't a content hash, and mishandles HEAD moves; the stat
pass is already cheap. Not worth the special-casing.

### 5. Hot-reload: default interactive, iframe-only reload, a11y re-trigger
Make the watch + live-reload behavior the **default** for `display-case .`
(retiring `--dev` as a required flag; a future `build` command becomes the static
pole). Broaden the watcher to component sources (`*.ts/tsx/css`). On rebuild,
instead of `location.reload()`, reload **only** the stage iframe (reassign
`frameRef.current.src` / bump a version query), preserving nav + panel state via
the existing `dc-ready`/`dc-render` handshake. A rebuild also invalidates the
affected variant's cached a11y entry and enqueues a rescan whose result is pushed
over the same SSE channel. **Why iframe-only:** full-page reload loses selection
and is jarring; the handshake already re-syncs content. **Why default-on watch:**
if you're running the server locally you're iterating; the idle cost is ~zero and
the per-save rebuild is what you want (see proposal's cost analysis).

### 6. Violation model gains `impact`
Extend `A11yViolation` to `{ id, help, nodes, impact }` and map axe's `impact`
through the driver. The panel orders violations by impact then node count; nav
marker counts stay as today (sum / per-variant). **Why:** real data is
contrast-dominated with wide node counts — severity is the triage signal a flat
list lacks. Tooling-internal shape change; the CLI report can include it too.

### 7. CLI gate independent of `a11y.enabled`, shares scan params
`check --a11y` runs whenever invoked, ignoring `a11y.enabled` (a local-DX
toggle must not silently disable the CI gate), but reads the shared scan params
(`themes`, `exclude`) from the same `a11y` config block so the panel and the
gate agree on what counts as a violation. **Why split:** prevents the footgun of
"turned off the local panel → accidentally stopped gating a11y in CI."

## Risks / Trade-offs

- **Scan latency / browser memory** → one reused browser + serial queue +
  on-demand-only; idle when nothing is viewed; the panel's `pending` state
  absorbs the wait so nothing blocks.
- **Cache staleness from an incomplete import crawl** (a transitive dep not
  captured → stale result) → fold shared inputs into every hash; err toward
  over-invalidation; offer a manual "re-scan" affordance on the panel.
- **Broadened watcher noise** (more rebuilds) → debounced; rebuild is cheap;
  iframe-only reload keeps it unobtrusive.
- **Making watch default changes current `display-case .` behavior** → behavior
  is strictly more helpful (live reload), and the future `build` command covers
  the no-watch/no-Playwright "just view a published site" need.
- **Playwright absent but a11y enabled** → graceful `unavailable` state; never a
  boot failure.

## Migration Plan

1. Add `a11y` config + lazy driver + `impact` on the violation shape (no
   behavior change until configured).
2. Add the scanner module (browser + queue) and the `.display-case/a11y/` cache
   with the layered hash check.
3. Wire `useShell` to request/receive results and populate the existing `a11y`
   view-model field; replace the page-case mock fixtures' role with live data
   (fixtures stay for the design exhibits).
4. Default the watch/live-reload on; switch reload to iframe-only; invalidate +
   rescan on rebuild; push results over SSE.
5. Point `check` at the shared scan params; keep it independent of `enabled`.

Rollback: the feature is gated by `a11y.enabled` (default off) — disabling the
config returns the prior behavior; the watcher/reload change can ship behind its
own step.

## Open Questions

- Cache invalidation across Display Case's **own** version bumps (chrome/render
  changes) — include the tool version in the hash, or clear the cache dir on
  version change?
- Should the panel expose a manual "re-scan this variant" control in v1, or rely
  solely on edit-triggered invalidation?
- `scope: 'on-view' | 'all'` — ship only on-view first, or also a background
  fill so nav markers populate without visiting every case?
