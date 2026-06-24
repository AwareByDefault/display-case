## Why

Display Case prepares the client and pre-render bundles by generating a single
entry that statically imports **every** case, then handing that one module graph
to one bundler pass. When cases are heavy — page/flow surfaces that transitively
pull in real application code and large vendor libraries, exactly the use the
Exhibits information architecture encourages — the aggregate graph grows large
enough to crash Bun's bundler outright (a native segfault before the server ever
listens). A consuming repo hit this at ~100 cases; the crash tracks total graph
size, not any single case, and shrinking individual cases does not avoid it.
Because preparation is all-or-nothing, one oversized (or simply broken) case
takes down the entire showcase with no indication of the culprit, and startup
cost grows with the catalog.

## What Changes

- The running showcase prepares each case's isolated rendering **independently
  and on demand** — when the case is first requested — instead of pre-bundling
  every case into one graph at startup. Startup stops scaling with case count.
- The published build prepares cases in **bounded units** rather than one
  whole-catalog pass, so a showcase of any size can be published.
- A single case that cannot be prepared is **isolated and diagnosed**: the rest
  of the showcase stays browsable, and the failure is attributed to that case
  (component, case, source file) instead of surfacing a bare, culprit-less
  native crash. Preparation that runs in an external process that may abort
  abnormally is detected and attributed rather than crashing the host.
- Heavy shared vendor code (e.g. large icon sets, data libraries) is kept out of
  each per-case graph so per-case preparation stays small — an internal
  mechanism, requiring no new configuration in the common case.
- Existing behavior is preserved: every surface is still server-rendered before
  scripting, every case keeps its stable deep-linkable address and chrome-free
  render endpoint, the catalog/manifest still enumerates every case, live reload
  still reflects edits, and the published build remains a standalone, dev-free
  deployable.

## Capabilities

### New Capabilities
- `scalable-serving`: serving and publishing a showcase of any size by preparing
  each case independently — on demand while running, in bounded units when
  publishing — and confining and diagnosing a single case's preparation failure
  instead of letting it take down the whole showcase.

### Modified Capabilities
<!-- None. The redesign changes how surfaces are prepared, not the observable
contract of any existing capability: server-rendering (rendered before
scripting), browsing-surface (stable addresses), render-endpoint, live-reload,
and publishing (standalone deployable) all keep their current requirements. -->

## Impact

- **Affected code:** `src/core/discovery.ts` (entry codegen — moves from one
  all-cases barrel to per-case entries), `src/server/server.ts` (`rebuild` and
  request routing — on-demand per-case build + cache, process isolation,
  failure attribution), `src/commands/publish.ts` (bounded/per-case build
  passes, shared vendor handling), and the render/mount path that assumes the
  whole case list is present at mount.
- **No public API or config change** in the common case; vendor isolation is
  internal. Any new optional config knob (if introduced) is additive.
- **Performance:** startup no longer scales with catalog size; first request to
  an unvisited case incurs its (small) build; rebuilds on edit become per-case.
- **Out of scope (possible follow-ups):** a `display-case check` bundle-graph
  budget and a barrel-import warning (recommendations F/G of the source report);
  filing the underlying Bun bundler crash upstream.
