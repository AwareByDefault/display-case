## 1. Shell SSR (the deferred work, in full) — DONE & verified

- [x] 1.1 Refactor `Shell`/`use-shell` to accept initial state as props — manifest, parsed route, theme — instead of fetching `/manifest.json` and reading `window.location` during first render (`src/ui/shell.tsx`, `src/ui/use-shell.ts`). *(Added `ShellSeed`; seeded manifest/sel/shownSel/theme/docOpen/mode/shownMode/expanded/a11y at init; removed the initial manifest fetch; nav-collapse moved to a post-mount effect; `origin` for shareable addresses seeded empty then filled in an effect — the one render-time `window` read that caused a mismatch.)*
- [x] 1.2 Add a pure `parseRoute(pathname, search)` + `resolveMode`/`initialSelectionFor` (`src/ui/shell-core.ts`), shared by server seed and client first render; `parseLocation`/`placardForLocation`/`initialSelection` now delegate.
- [x] 1.3 Server-render the shell from the in-memory manifest + request route (`src/ssr-shell.tsx`, `src/server.ts`), inline the seed as `window.__DC_SEED__`, set `data-theme`, flag `#root data-ssr`. No consumer-module import. Defensive try/catch falls back to client-only on a shell defect.
- [x] 1.4 Client adopts: `browser-entry.tsx` reads the inlined seed + live route and `hydrateRoot`s the seeded `<Shell>` (createRoot fallback when `data-ssr="0"`), logging adopt mismatches.
- [x] 1.5 Stage iframe element + src match across server/client (hydration verified clean); the chrome↔iframe `postMessage` swap still drives in-place changes after hydration (verified: `/c/button/playground` stage srced correctly).
- [x] 1.6 Shell interactivity verified post-hydration: theme toggle (light→dark), nav navigation (`/c/button/sizes`, URL+history), stage iframe, no page errors; landing lands per config (placard). Hydration clean on `/` and deep links in the browser.

## 2. Production bundling — DONE & verified

- [x] 2.1 Production `Bun.build` path (`src/publish.ts`): `process.env.NODE_ENV='production'` define, `minify: true`, content-hashed entry/chunk/asset names, `sourcemap: 'none'`. *(Verified: emits `browser-entry-<hash>.js` etc.)*
- [x] 2.2 Production documents (`src/documents.ts`) omit the `/__livereload` SSE client and the `process/Bun is not defined` error overlay; keep only the app's own (hashed) script. *(Verified: no `__livereload`/`EventSource` in served or static output.)*
- [x] 2.3 Caching policy (`src/prod-server.ts`): hashed assets `public, max-age=31536000, immutable`; HTML `no-cache`. Filenames are content-hashes (reproducible, no timestamps). *(Verified via response headers.)*

## 3. `publish` command + production server — DONE & verified

- [x] 3.1 `publish` CLI subcommand: `display-case publish <pkgDir> [--out=<dir>] [--base=<path>] [--static]` (`src/cli.ts`).
- [x] 3.2 `src/publish.ts`: discovery + codegen once → production browser bundle + bun-target SSR bundles → frozen `manifest.json`/`dc-build.json` (styles + asset map) → self-contained output.
- [x] 3.3 `src/prod-server.ts`: thin `Bun.serve` rendering shell/render/placard via the SAME SSR renderers (`ssr-shell`/`ssr-render`/`ssr-placard`) through `documents.ts`, with the caching policy, `/health`, and `--base` support — and none of the dev machinery. *(Verified: served build hydrates + theme toggle works in a browser; health/cache/no-dev-injects all pass.)*
- [x] 3.4 Output is runnable standalone: emits `server.ts` (start script), `package.json` (start + deps), and a `Dockerfile` with a healthcheck. *(`server.ts`/`package.json`/`Dockerfile` generated; an actual `docker build` was not run in-session.)*

## 4. Static export (`--static`) — DONE & verified

- [x] 4.1 Crawl every address — shell `/`, every `/c/<component>/<case>`, every `/render/<component>/<case>`, placard — and write complete HTML files alongside the hashed bundle (`writeStaticExport` in `src/prod-server.ts`). *(Verified: 211 files; served from a dumb static host, `/` + a deep link hydrate and are interactive with no app server.)*
- [x] 4.2 The static boundary is logged explicitly (query-encoded tweak/theme variations have no per-path file; they resolve client-side on hydrate). *(gzip/brotli precompression left as an optional follow-up.)*

## 5. Verification

- [x] 5.1 Built the served form of the dogfood, ran it standalone, confirmed pre-scripting content on shell/`/c`/render, no dev endpoints, no live-reload, correct cache headers, `/health`.
- [ ] 5.2 Re-run the visual-regression baseline diff across **all** surfaces (now including the shell) pre- vs post-change in both themes. *(Render/placard are unchanged by this change; the shell `/` app has no committed baseline — the check snapshots `/render` addresses. Hydration is clean and the cased shell components still pass. A full pre/post diff run is recommended before merge.)*
- [x] 5.3 Built a `--static` export, served it from a plain static file server, confirmed shell + a deep-linked case render and hydrate with no running app server.
- [x] 5.4 The published build carries no watcher, check toolchain, or dev endpoints (the prod server imports only the frozen build + SSR renderers).

## 6. Docs

- [x] 6.1 `packages/display-case/README.md` — "Publish / hosting" section (the `publish` command, served vs `--static` forms, base path, what's excluded).
- [x] 6.2 `docs/NOTES.md` — shell-SSR seeding, the dev-vs-prod server split, the static-export boundary, production build defaults.
- [x] 6.3 `docs/DEPLOYMENT.md` — "Publishing a Display Case showcase" (served form via Dockerfile/Railway + subpath; static form to a static host).
- [x] 6.4 `AGENTS.md` — the `publish` workflow added to the Display Case agent section.
