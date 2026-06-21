## Context

The accessibility gate (`src/check.ts`) drives the audit mechanism over each
`/render/<component>/<case>?theme=…` and reports violations. The mechanism is
pluggable (`config.providers.driver`, the "Configurable snapshot pipeline"
requirement); the built-in default is Playwright + axe-core
(`src/providers/playwright-driver.ts`). axe returns rich per-node data — the
failing element's selector and `outerHTML`, a `failureSummary`, and for
`color-contrast` a `data` object with `fgColor`, `bgColor`, `contrastRatio`,
`expectedContrastRatio`, `fontSize`, `fontWeight`. The built-in mechanism
currently collapses each violation to `{ id, help, nodes: <count>, impact }`,
dropping all of it. The live scanner (`src/a11y-scanner.ts`) persists violations
per variant under `.display-case/a11y/`; the gate persists nothing.

## Goals / Non-Goals

**Goals:**
- Carry the per-node detail the audit already computes through to the gate's
  output and a persisted result, so a finding is fixable without re-running.
- Keep the detail model **mechanism-neutral**: a generic shape any audit engine
  can populate, with the engine-specific extraction isolated in the default
  mechanism.
- Leave the in-app surface unchanged — detail is for the gate/cache, not the
  panel.
- Additive and optional: existing consumers, custom mechanisms, and the live
  panel keep working untouched.

**Non-Goals:**
- Surfacing per-node detail in the in-app panel (deliberately summary-only).
- Auto-fixing; scanning tweaked variant states.

## Decisions

### Mechanism-neutral detail shape, engine-specific extraction
`A11yViolation` gains an optional `details?: A11yNodeDetail[]`. `A11yNodeDetail`
is `{ target, html, failureSummary?, contrast? }` and `A11yContrast` is
`{ foreground, background, ratio, required, fontSize?, fontWeight? }` — all
generic WCAG/DOM concepts, defined in the shared `src/index.ts` contract, with
no axe vocabulary. The axe → detail mapping lives only in the default mechanism
(`playwright-driver.ts` `nodeDetail()`), reading `node.any/all/none` for the
`color-contrast` check's `data`. A consumer-supplied mechanism returns
`A11yViolation[]` and MAY populate `details` from its own engine or omit it; the
field is optional precisely so a non-axe mechanism is not forced to model it.
This is why the spec says detail is carried "where the audit mechanism provides
it" rather than unconditionally.

### Gate prints detail; a pure formatter keeps it testable
`check.ts` exposes `a11yDetailLines(v): string[]` — a pure function that renders
a violation's detail as indented lines (`↳ <selector>  <fg> on <bg> = <ratio>:1
(need <required>:1)  [<font>]` for contrast, `↳ <selector>  <summary>`
otherwise). Pure so it is unit-tested without a browser (the gate's a11y path is
otherwise e2e-only). The inline list is capped (8 nodes/violation) with a
"+N more" note to keep a noisy run readable; the full set is always in the
persisted report.

### Persisted report: one consolidated file, not the per-variant cache
The gate does not use the live scanner's per-variant cache (that cache is keyed
by a transitive-input hash the gate doesn't compute). Instead the gate writes a
single `.display-case/a11y/last-check.json` —
`{ scannedAt, total, results: [{ component, case, theme, violations }] }` —
containing only failing variants, overwritten each run, empty `results` on a
clean run. One file is the AI-friendly artifact: the whole run in one read,
under the already-gitignored cache dir. The live scanner's per-variant entries
also now carry `details` for free (it serializes whatever the mechanism
returns), so the in-app cache gains the detail too — but the panel keeps reading
only the summary fields.

### In-app surface stays summary-only
The panel reads `id`/`help`/`nodes`/`impact`; the added `details` rides along in
the result payload and is ignored. No panel change — honouring "surface only the
current data in the UI." The spec leaves the panel's content unspecified beyond
the verdict, so this is not over-constrained: a future change could choose to
surface detail without contradicting the spec.

## Risks / Trade-offs

- **Output verbosity** on a failing run — mitigated by the 8-node inline cap; the
  complete data is in the persisted report.
- **`details` is optional** — the spec qualifier "where the audit mechanism
  provides it" keeps custom mechanisms valid when they can't model per-node
  colours.
- **Report payload size** for a large library — bounded to failing variants
  only; the file is gitignored and overwritten, not accumulated.
