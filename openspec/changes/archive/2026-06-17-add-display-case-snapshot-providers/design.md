## Context

`check.ts` statically imports `playwright`, `@axe-core/playwright`, `pixelmatch`, and `pngjs`, and the runner is a fixed loop: for each case × theme it opens a Playwright page at the case's `renderUrl`, runs axe on it, screenshots it, and pixel-diffs against a baseline. The browse server and `init` need none of this. We want the visual pipeline to be swappable (so a consumer can reuse an existing browser setup or a different capture/diff) and the heavy packages to be genuinely optional, while keeping today's zero-config behavior intact.

## Goals / Non-Goals

**Goals:**
- Make capture+audit and image-diff overridable via `display-case.config.ts`, defaulting to today's behavior.
- Lazy-load the default backend so it's required only when actually used; make those packages `optionalDependencies`.
- An opt-in `init` step that sets up the default toolchain (packages + browser).
- No behavior change when unconfigured with the default deps present.

**Non-Goals:**
- Not changing the manifest, render endpoint, or token-conformance phase.
- Not shipping alternative built-in backends (puppeteer, cloud capture) — just the seam.
- Not making the a11y *rule set* pluggable (still WCAG 2 A/AA); only the driver that hosts it.

## Decisions

### D1 — One injectable render driver (capture + audit) + one injectable diff

Capture and a11y audit both need to drive a browser at a URL, so they belong to one provider; image diff is independent. The config gains:

```ts
/** Identity of the case being rendered, passed to providers (Option B). */
interface CaseContext {
  componentId: string
  caseId: string
  theme: 'light' | 'dark'
  width: number
}

interface RenderDriver {
  /** Open a case's render URL and return a handle; reused across cases. */
  open(url: string, ctx: CaseContext): Promise<RenderedPage>
  close(): Promise<void>
}
interface RenderedPage {
  screenshot(): Promise<Uint8Array>
  /** Accessibility violations (WCAG A/AA), or [] — driver hosts the audit. */
  audit(): Promise<A11yViolation[]>
  dispose(): Promise<void>
}
type DiffFn = (
  input: { baseline: Uint8Array; actual: Uint8Array },
  ctx: CaseContext & { baselinePath: string },
) => { changed: boolean; mismatch?: number; diffImage?: Uint8Array }

interface DisplayCaseConfig {
  // …existing…
  providers?: {
    /** Factory for the render driver; default = built-in Playwright driver. */
    driver?: () => RenderDriver | Promise<RenderDriver>
    /** Image comparison; default = built-in pixelmatch/pngjs diff. */
    diff?: DiffFn
  }
}
```

`check.ts` becomes backend-agnostic: resolve `driver`/`diff` from config or fall back to the defaults, then run the same loop, threading the `CaseContext` through both. **Alternative considered:** three separate hooks (capture, audit, diff) — rejected; capture and audit share a page, so splitting them forces consumers to open the page twice or manage shared state. One driver that yields a page is the natural unit.

**Provider context (Option B, locked in).** Both providers receive the case identity (`componentId`, `caseId`, `theme`, `width`; the diff additionally gets `baselinePath`). Pure providers ignore the second argument and stay one-liners (`({ baseline, actual }) => …` is still assignable), while integrations that need identity get it: per-case diff tolerance, name-keyed hosted VR services (Percy/Chromatic-style, which own the baseline and ignore the passed `baseline`), and richer per-case reporting. This is forward-compatible with a future "provider owns baselines" mode without changing the contract now. The built-in defaults ignore the context except where it improves a label.

### D2 — Defaults live behind lazy imports

The built-in driver and diff move into their own modules (e.g. `src/providers/playwright-driver.ts`, `src/providers/pixelmatch-diff.ts`) that are **`await import()`-ed only when the corresponding provider is not overridden**. So:
- custom `driver` + custom `diff` → neither default module is imported → none of the four packages are needed;
- default `driver`, custom `diff` → only Playwright/axe are imported;
- nothing configured → both defaults import their deps on first use.

A failed lazy import is caught and rethrown as a clear message: *"Visual checks need the default toolchain. Install it (`bun add -d playwright @axe-core/playwright pixelmatch pngjs && bunx playwright install chromium`) or set `providers.driver`/`providers.diff` in display-case.config.ts."* **Alternative considered:** a hard top-level import guarded by try/catch — rejected; ESM hoists static imports, so the module would fail to load before the guard runs. Dynamic import is required for true optionality.

### D3 — Packages become `optionalDependencies`

`playwright`, `@axe-core/playwright`, `pixelmatch`, `pngjs` move from `devDependencies` to `optionalDependencies`. In this workspace they still install (so checks keep working with zero config); a standalone consumer who only browses/snapshots/inits doesn't pay for them, and `optionalDependencies` won't fail their install if (e.g.) a platform can't fetch a browser. The lazy-import guard (D2) is what actually enforces presence at use time. **Alternative considered:** plain `dependencies` — rejected as too heavy for the common browse-only use; `peerDependencies` — rejected as worse DX (consumer must hand-add them even for the default path).

### D4 — `init --with-visual` (opt-in), prompt when interactive

`display-case init` gains an opt-in setup step for the default toolchain:
- **Non-interactive / agents:** `--with-visual` performs it (add the optional packages as dev deps + `playwright install chromium`); absent, it's skipped and `init` prints a one-line hint that visual checks need it.
- **Interactive (TTY):** if `--with-visual` is not passed, prompt once ("Set up Playwright + pixelmatch + pngjs for visual-regression checking? [y/N]"); declining is a no-op for that step.
The step is reported as its own plan item (`created`/`skipped`) and honors `--dry-run`/`--json` like the rest of `init`. **Alternative considered:** always prompt — rejected; `init` must stay non-interactive-safe for agents, so the prompt is TTY-only and the flag is the canonical path.

## Risks / Trade-offs

- **Provider contract is a new public API** → keep it minimal (one driver yielding a page + one diff fn); document it in `docs/configuration.md` with the built-in as the reference implementation.
- **Lazy-import error ergonomics** → the thrown message must be actionable (exact install command + the config alternative); covered by D2 and a test that simulates the missing-deps path.
- **`init` installing packages / downloading a browser** → only on explicit opt-in (`--with-visual` or an interactive yes); never silent; `--dry-run` previews it.
- **Behavioral parity of the default** → the extracted default driver/diff must reproduce current output (same viewport, reduced motion, fonts-ready wait, threshold) so existing baselines still match.

## Migration Plan

1. Extract the current Playwright capture+audit and pixelmatch/pngjs diff into default provider modules behind lazy imports.
2. Add `providers` to `DisplayCaseConfig`; make `check.ts` resolve config-or-default; add the missing-deps guard.
3. Move the four packages to `optionalDependencies`.
4. Add the `init --with-visual` step (+ TTY prompt) wired through the existing plan/report/`--json`/`--dry-run`.
5. Document the provider interface and the `init` step; verify zero-config checks are unchanged and a custom-provider run needs none of the four packages.

Rollback: drop the `providers` config and the `--with-visual` step; restore static imports and `devDependencies`.

## Open Questions

_None outstanding._

**Resolved:**
- **Provider context** → both the driver and the diff receive an optional `CaseContext` (`componentId`, `caseId`, `theme`, `width`; diff also gets `baselinePath`) — Option B. Pure providers ignore it; identity-dependent integrations (per-case tolerance, name-keyed hosted VR services, richer reporting) get what they need. Forward-compatible with a later baseline-owning provider.
