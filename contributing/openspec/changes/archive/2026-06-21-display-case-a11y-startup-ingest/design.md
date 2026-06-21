## Context

Display Case's in-app accessibility surfacing is purely lazy. The dev server
serves a `Manifest` with no a11y data (`server.ts` `/manifest.json`), and the
client navigation state starts empty (`use-shell.ts`: `byVariant: {}`). A
variant's marker appears only after the client viewing that variant fetches
`/a11y?component=…&case=…&theme=…`, which calls the scanner's
`request(componentId, caseId, theme)` (`a11y-scanner.ts`). That request either
returns a reusable cached result immediately or queues a live scan whose verdict
is later pushed over the `/__livereload` SSE channel as an `a11y` event and
folded into `byVariant` by `applyA11yResult`.

The on-disk cache lives at `<showcase>/.display-case/a11y/{component}__{case}__{theme}.json`.
Reusability is decided per key by `cachedViolations`: a fast path compares each
recorded file's `mtimeMs`/`size`, and a slow path recomputes a SHA-256
fingerprint over the variant's transitive imports; a `toolVersion` mismatch
discards the entry. There is no bulk cache reader and nothing reads the cache
directory at start-up.

The a11y config block today is `{ enabled?, themes?, exclude? }` in `index.ts`
(`DisplayCaseConfig`). The complete set of variants is derivable from the
manifest's components (their case ids) crossed with the configured themes
(default light + dark).

## Goals / Non-Goals

**Goals:**

- Add a configured start-up population mode controlling how the navigation's
  a11y markers are filled when the server starts.
- `cached`: populate markers from existing reusable cache entries with zero
  scanning.
- `refresh`: scan every uncached or stale variant at start-up and surface
  verdicts as they land, while reusing fresh cache entries.
- Preserve today's behavior exactly when the mode is unset (`off`).
- Never block the browsing surface or variant rendering during start-up
  population.

**Non-Goals:**

- No change to the CLI a11y gate (`bun run … a11y`) or visual-regression checks.
- No change to the on-demand per-viewed-variant flow, the cache format, or the
  reusability decision logic.
- No new way to invalidate or clear the cache; `refresh` re-scans only what is
  already considered stale by the existing fingerprint logic.
- No persistence of the start-up batch beyond the existing per-key cache files.

## Decisions

### Configuration shape

Add a field to the existing `a11y` block rather than a new top-level key:

```ts
a11y?: {
  enabled?: boolean
  themes?: ('light' | 'dark')[]
  exclude?: string[]
  /** How navigation markers are populated at start-up. Default 'off'. */
  startup?: 'off' | 'cached' | 'refresh'
}
```

Rationale: start-up population only has meaning when `enabled` is true, so it
belongs alongside it. A string enum (not two booleans) makes the three states
mutually exclusive and leaves room for future modes. `off` as the default keeps
the change backward-compatible — unset config behaves exactly as today.

Alternatives considered: a boolean `prewarm` plus a boolean `rescanStale` —
rejected because it admits a meaningless fourth combination and reads less
clearly than a single mode.

### Scanner gains a bulk start-up entry point

Add a method to the scanner (built in `createA11yScanner`) that the server calls
once after the server URL is known and the scanner exists:

- `populateAtStartup(variants, mode, onResult)` where `variants` is the full
  `{componentId, caseId, theme}` list derived from the manifest × configured
  themes.
- For each variant it computes the key and consults the **existing**
  `cachedViolations(componentId, key)` reuse logic — no new reusability rules.
  - `cached` mode: for every variant with a reusable result, invoke `onResult`
    (the same callback the server already wires to the SSE broadcast). Do
    nothing for variants without a reusable result. Run no scans.
  - `refresh` mode: emit reusable results immediately (as in `cached`), and for
    every variant whose result is **not** reusable (never scanned or stale),
    enqueue it on the existing scan `queue`/`pump()` so it flows through the
    same `runJob` → `onResult` → SSE path as an on-demand scan.

Rationale: reusing `cachedViolations` and the existing queue means start-up
population produces byte-identical verdicts to the lazy path and inherits its
concurrency cap and in-flight de-duplication. The server already owns the
`onResult` → `broadcast` wiring; the scanner just feeds it more results.

Alternatives considered: a brand-new bulk cache reader that globs the cache
directory — rejected because it would duplicate the two-tier reuse decision and
could drift from the lazy path's notion of "reusable."

### Surfacing the start-up batch to the client

The navigation already updates from SSE `a11y` events via `applyA11yResult`.
Start-up population reuses that exact channel: each populated/landed verdict is
broadcast as an `a11y` SSE event, so the client needs no new transport.

One concern: SSE clients only receive events emitted after they connect. A
browser opened after the `cached`-mode burst finished would miss those events
and show an empty navigation. To close that gap, the server holds the latest
known verdict per `{component, case, theme}` (it already receives them through
`onResult`) and exposes them in the initial client payload — either folded into
`/manifest.json` or as a sibling the shell fetches on load — so a late-joining
client renders the already-known markers without re-fetching per variant. The
existing `window.__displayCase` config (`clientConfigScript`) continues to carry
only the `a11y` enabled flag; the verdicts ride alongside the manifest.

Rationale: keeps live updates on the existing SSE path while making the
populated state durable for the session against reconnects and late joins.

### Start-up timing

`populateAtStartup` is invoked after the server is listening and the scanner is
constructed (the same block that wires `onResult`), and runs detached (not
awaited) so it never delays the server becoming reachable. `refresh` work rides
the existing bounded scan queue, so it cannot starve on-demand requests beyond
the existing concurrency limits.

## Risks / Trade-offs

- **Late-joining SSE clients miss the start-up burst** → server retains
  last-known verdicts and includes them in the initial payload (see above) so a
  client connecting after the burst still renders markers.
- **`refresh` over a large catalog spends CPU at start-up** → work flows through
  the existing capped scan queue and runs detached; the browsing surface stays
  responsive, and on-demand requests for a viewed variant are de-duplicated
  against in-flight start-up jobs by the existing `inFlight` set.
- **Stale detection cost** → `refresh` recomputes fingerprints for variants
  whose stat fast-path misses; this is the same cost the lazy path already pays
  on first view, just front-loaded. `cached` mode avoids it entirely for the
  fast-path hits.
- **Scanning prerequisite unavailable** → `populateAtStartup` short-circuits
  (the scanner already reports `unavailable`); no markers are populated and the
  surface shows the unavailable state, matching the existing requirement.

## Migration Plan

Additive and backward-compatible. Existing showcases with no `a11y.startup`
default to `off` — identical to current behavior. No data migration; the cache
format is unchanged. Rollback is removing the config field / reverting the
package; cache files remain valid for the lazy path.

## Open Questions

- Initial-payload delivery: fold verdicts into `/manifest.json` versus a
  dedicated endpoint the shell fetches once. Leaning toward a dedicated
  read-only endpoint to keep the manifest a pure component index (consistent
  with the "catalog stays an index" spec language), resolvable at implementation.
- Whether `refresh` should also re-emit a "complete" signal once the start-up
  queue drains (purely cosmetic — to distinguish "still scanning" from "all
  done" in the navigation). Default: no, to avoid new surface area.
