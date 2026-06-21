## Context

Pre-scripting rendering already covers the two isolated documents: `/render/<component>/<case>` and `/render/placard` server-render their content and the client adopts it (`render-node.tsx`'s shared `caseTree`, `ssr-render.tsx`/`ssr-placard.tsx`, fresh-bundle import per rebuild). The **shell** — `/`, `/c/<component>/<case>`, `/placard` browse routes — is still a client-only SPA: `browser-entry.tsx` mounts `<Shell>`, which fetches `/manifest.json`, routes from `window.location`, owns the stage iframe, and drives the live-reload SSE and a11y panel. There is no production build: the dev server watches, rebuilds on demand, bundles unminified, and injects a live-reload + error-overlay script into every document.

This change finishes shell SSR and builds the deployable artifact on top of it. Two deliverables, one depends on the other: a hostable landing/browse experience needs the shell to pre-render.

## Goals

- The shell delivers its content (nav tree, selected case framing, chrome) before scripts run, then hydrates — same address, same snapshots, same interactivity.
- `display-case publish` emits a self-contained, hostable build: a production server + optimized bundle by default, an optional fully-static export, runnable with no dev machinery.
- Production best practices are the default, not a flag: minified hashed assets, immutable asset caching, no dev-only injects or endpoints, reproducible output, a health signal, base-path support.
- Zero authoring change; the dev server is untouched.

## Decisions

### Shell SSR: seed the shell, don't fetch
`<Shell>` and `use-shell` are refactored to accept their initial state as props — the manifest, the initial route, and the theme — instead of fetching `/manifest.json` and reading `window.location` during the first render. The server renders `renderToString(<Shell manifest={state.manifest} route={parseRoute(path)} theme={theme} />)` directly from the in-memory manifest it already holds (no consumer-module import needed — the shell tree depends only on manifest *data* and the route, so it sidesteps the fresh-bundle staleness machinery the case renderer needs). The client reads the same manifest from an inlined JSON island and `hydrateRoot`s the same tree. `window`/history, the live-reload `EventSource`, the a11y fetches, and `ResizeObserver`/device-size reads all move into effects (they already mostly are), so they run only on the client, after hydration — keeping the server render pure and the hydration tree matching.

### Inline the catalog; keep `/manifest.json` for its contract
The document embeds the manifest as a script-readable JSON island; the client adopt reads it instead of blocking on a fetch. `/manifest.json` remains for the machine-readable catalog contract and (in dev) live-reload refresh — it is simply off the first-paint critical path.

### The stage iframe is pre-rendered by reference
The shell's stage is an `<iframe src="/render/<component>/<case>?theme=…">`. The server emits that element with the resolved src; its document is already pre-rendered by the existing case path. Hydration parity only requires the iframe element (and its src) to match — the iframe's *content* loads independently. The chrome↔iframe `postMessage` handshake is unchanged and runs after hydration.

### Route from the request path, deterministically
A small pure `parseRoute(pathname)` maps `/` → landing (placard or library per config), `/c/<component>/<case>` → that selection, `/placard` → placard mode. The server passes the parsed route as the seed; the client's first render uses the same seed (not `window.location`), so the two agree. Theme is seeded from a query/cookie default; like the isolated render, a known theme up front means no flash and no mismatch.

### `publish`: build once, serve without the dev loop
`display-case publish <pkgDir> [--out <dir>] [--base <path>] [--static]` runs discovery + codegen once, produces a **production** bundle (see below), pre-renders the documents, and writes a self-contained output directory. Default output is a **served build**: a generated `prod-server.ts` (a thin `Bun.serve`) that serves the pre-rendered shell/render/placard documents and the hashed assets — reusing the existing document renderers (`server.ts`'s `renderHtml`/`placardHtml`/the new shell renderer) but with none of the dev machinery: no watcher, no rebuild, no `/__livereload`, no on-demand a11y, no dev endpoints. It renders documents on request (so address-encoded tweaks/themes still SSR with full fidelity) from the build's frozen manifest + bundles. The output also carries a minimal `package.json` (start script) and a `Dockerfile`, so it deploys like any service in this repo (Railway, one Dockerfile).

### Production bundling best practices, on by default
The publish build differs from the dev build deliberately:
- **Minified, content-hashed** entry + chunk + asset filenames (`[name]-[hash].js`), built with `NODE_ENV=production` so React drops dev warnings and is smaller/faster.
- **No dev injects.** The live-reload SSE script and the `process/Bun is not defined` error-overlay script are dev-only and omitted; the document carries only the app's own scripts. This also keeps the markup CSP-friendlier (no surprise inline behavior).
- **Caching:** hashed assets are served `Cache-Control: public, max-age=31536000, immutable`; HTML documents are `no-cache` (they embed the current manifest and must not stain). 
- **Reproducible:** filenames derive from content hashes, not timestamps; the output is stable for the same input (important for diffable deploys and the no-`Date.now()` discipline).
- **Health + base path:** `/health` is retained for platform probes; `--base <path>` rewrites asset URLs and route matching so the showcase can be hosted under a subpath.

### `--static`: a server-less export, with an honest boundary
`--static` crawls every address — the shell `/`, every `/c/<component>/<case>`, every `/render/<component>/<case>`, and the placard — for the configured theme(s) and writes complete HTML files plus the hydration bundle. No runtime needed; deploy the directory to any static host. The boundary, stated plainly (and logged): static files are keyed by *path*, not query, so a deep-linked **tweaked** address (`?t.x=…`) or an off-default theme has no pre-rendered file — the base document is served and the client applies the query on hydrate (the same client path the dev server uses). Default states are fully pre-rendered; address-encoded variations resolve client-side. Optional gzip/brotli precompression of static assets.

### A11y/visual surfaces are dev-only in a publish
The live a11y scanner needs the Playwright/axe toolchain and an on-demand server loop — neither belongs in a hosted build. `publish` omits the live a11y panel by default; a follow-up MAY bake the last `check` verdicts in as static read-only data. The component content is unaffected.

### Reconciling "development-only"
The existing requirement forbids Display Case in *consuming application* artifacts — to keep the product apps lean. A published showcase is a *separate* artifact a team deploys on purpose; it is not part of any consumer's app build. The spec delta narrows the prohibition to consuming applications and names the publish build as the sanctioned exception.

## Risks / Trade-offs

- **Shell hydration parity is the real risk.** The shell is the most stateful surface; a `window.location`/device-size read during first render would mismatch. Mitigated by seeding all such inputs from props and confining the rest to effects, and by re-running the visual-regression baseline diff (now proven clean for render+placard) across the shell before merge.
- **Two server entries** (dev `server.ts`, prod `prod-server.ts`) could drift. Mitigated by both delegating to the *same* document renderers; `prod-server` is a thin host, not a parallel renderer.
- **Static export under-covers** tweaked/themed deep links. Accepted and **logged** — not silently truncated; the served build is the full-fidelity option and is the default.
- **Build surface area** (bundling flags, Docker, base path) is new. Mitigated by leaning on the existing `Bun.build` path with a production config, and the repo's established one-Dockerfile-per-service deployment.

## Migration

None for consumers. Authoring, addresses, and the dev server are unchanged. `publish` is additive and opt-in. The shell SSR is invisible except for arriving sooner; a showcase that never publishes still benefits from the faster shell first paint.
