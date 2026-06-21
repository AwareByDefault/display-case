## Context

Display Case is Bun-native and bundler-free. The dev server (`src/server.ts`) discovers `*.case.tsx` files, codegens static import-list entry modules (`src/discovery.ts`), and bundles them with `Bun.build` into a browse bundle, an isolated-render bundle, and a placard bundle. Each route returns an HTML template whose body is essentially empty; the matching bundle mounts React on the client and renders:

- `/` and `/c/<component>/<case>` → the shell fetches `/manifest.json`, then renders the catalog and the selected case in an iframe.
- `/render/<component>/<case>` → the isolated bundle reads the URL (`theme`, `width`, `t.<tweak>`), calls the case's render function, and paints it.
- `/placard` → the placard bundle renders compiled MDX with live specimens.

The server already holds everything needed to produce that content before the browser does: it builds the manifest in-process, it knows the requested theme from the query string, and the case modules are already imported during discovery. The only reason the content appears late is that we never render it server-side. This change closes that gap "wherever possible" and treats the cases that genuinely cannot render outside a browser as a bounded, gracefully-handled exception.

## Goals

- Every addressable surface delivers complete, themed content before its own scripts run.
- Identical output: same markup, same snapshots, same baselines, same addresses. SSR is invisible except for being present sooner.
- No author burden: existing cases and placards gain pre-rendering with no config or code change.
- A clean seam for the future "build production webapp" export: once a handler can produce a full document for an address, a build step can walk addresses and write documents — no new rendering work required there.

## Decisions

### Render with `react-dom/server` under Bun, adopt on the client
Each document handler renders the relevant React tree to HTML with `renderToString` (Bun supports `react-dom/server`) and embeds the markup in the delivered document. The existing client bundle changes from "mount and render from nothing" to "adopt the already-rendered markup" via `hydrateRoot`. The render tree is the *same* tree the client already builds for that surface — extracted into one pure, DOM-free function (`render-node.tsx`'s `caseTree`) that both the server renderer and the client mount call — so the two cannot drift. A `#root` `data-ssr="1|0"` flag tells the client whether to `hydrateRoot` (adopt) or `createRoot` (mount fresh, the fallback case).

### Refinement (implementation): fresh-built bundle, not in-process import
The server process **cannot** safely `import()` the case modules directly: Bun caches modules by resolved path and ignores `?v=` busting, so after a watch rebuild an in-process import would return the *stale* module (the documented reason the manifest is built in a subprocess). The fix that keeps per-request SSR — needed for arbitrary theme/tweak/width from the address — is to **codegen a server-target SSR entry, build it with `Bun.build({ target: 'bun' })` to a sequence-named file each rebuild, and `import()` that fresh path.** The bundle inlines the case source from disk, so it is always current — the in-process equivalent of why the browser render bundle is always fresh. React stays `external` so it resolves from `node_modules` at import time. The placard gets a second small bundle the same way. (Cost: a per-rebuild build, plus a module-graph that accumulates over a long dev session — acceptable for a dev tool.)

### The theme is known at request time, so there is no flash and no mismatch
Theme comes from the `?theme=` query parameter (isolated render) or the surface's selected theme, both available to the handler. The server sets `data-theme` on the rendered document and renders the tree under that theme, so the first paint is already correct and the subsequent adopt finds a matching tree. This is why SSR here is safe: the one input that usually causes server/client divergence (theme) is deterministic and known up front. Tweaks are likewise decoded from the address on the server and rendered into the initial markup, so a shared tweaked address paints its tweaked state before scripts run.

### Static cases ship without an adopt step; interactive ones adopt
A case with no tweaks and no interactive content needs nothing from the client to *be correct* — its server markup is final, so in principle it could ship as pure HTML with no client mount. **Refinement (implementation):** "no interaction" is not knowable from a case's shape — a tweak-free `() => <Button onClick=…>` is fully interactive — so dropping the bundle for tweak-free cases would silently dead-drop event handlers. We therefore always ship the markup *and* adopt it (hydrate). Pre-scripting content (the actual spec requirement) is delivered either way; the pure-static, no-bundle omission is left as a future optimization gated on an explicit author opt-in (a `static: true` case flag), where the author vouches that the case is non-interactive.

### Graceful per-case fallback for browser-only cases
"Wherever possible" is load-bearing. Some cases touch browser-only APIs (`window`, `IntersectionObserver`, canvas, layout measurement) during render and will throw under `renderToString`. The render harness renders each case in a try/catch: on failure it emits the document with an empty placeholder for that case plus a client mount that renders it in the browser, and records the case as browser-only so repeat renders skip the server attempt. A case MAY also declare itself browser-only to opt out of server rendering deliberately. Either way the surrounding surface still server-renders fully; one browser-bound case never degrades the rest. This keeps the change backward compatible with every existing case.

### Inline the catalog the first paint needs
The shell currently can show nothing until `/manifest.json` arrives. Since the handler renders the shell from the in-memory manifest, it could inline that same catalog data into the document (a script-readable JSON island) and render the tree against it, with the client adopt reading the inlined catalog instead of re-fetching. The `/manifest.json` endpoint stays for the machine-readable catalog contract and live-reload refreshes. **Status: deferred with the shell — see below.**

### Shell: deferred
The two isolated documents (`/render` and `/placard`) are the high-value, self-contained pre-render targets, and both are implemented and verified. The **shell** is intentionally left for a follow-up:
- It is an interactive SPA: it routes from `window.location`, owns the stage **iframe** (whose case content is *already* pre-rendered by the `/render` work), and drives the live-reload **SSE** stream and the **a11y** panel.
- Its no-JS value is the sidebar/nav list — modest — while full-tree SSR + manifest-inlining touches the shell's loading state machine and several manifest fetch sites (`use-shell.ts`), with real regression risk to routing/a11y.
- The spec's "wherever possible" + graceful-fallback posture explicitly permits leaving an interactive surface client-rendered as the documented boundary.

So this change delivers pre-scripting content for the snapshot/reading surfaces; shell SSR (tasks 3.1–3.2) is recommended as a separate, browser-tested follow-up.

### Determinism constraints, made explicit
Pre-rendering requires the server and client trees to match. Stable React ids (`useId`) already match across the two. The risks are non-deterministic values used during render — `Date.now()`, `Math.random()`, locale/timezone-dependent formatting. These already make a case a poor snapshot subject; under pre-rendering they cause an adopt mismatch and a client re-render. The render harness logs an adopt mismatch against the offending case (so authors can see it), and the case still renders correctly because adopt falls back to client rendering on mismatch. We document this as a case-authoring constraint rather than trying to defeat it.

### Live reload and discovery are unchanged
The dev server keeps watching, rebuilding, and broadcasting `/__livereload`. Pre-rendering happens inside the request handler against the current build, so an edit still triggers a rebuild and the next request renders the new content. Nothing about the dev loop changes; only the shape of each delivered document does.

## Risks / Trade-offs

- **Adopt mismatches from non-deterministic cases.** Mitigated: adopt falls back to client rendering and the harness logs the case, so correctness is preserved and the author gets a signal. Not silently swallowed.
- **Server render cost per request.** Mitigated in dev (single user, already rebuilding on change); and the static-case path renders plain HTML with no client mount at all. The future export step renders each address once at build time, where cost is irrelevant.
- **Browser-only cases reduce coverage.** Accepted and bounded: those cases still render (in the browser) and are recorded, so the boundary is visible rather than a surprise. A future export can list which addresses are browser-only.
- **Two render entry points (server + adopt) for the same tree** could drift. Mitigated by reusing the *same* entry components for both, not forking a parallel server renderer.

## Migration

None for consumers. The feature is automatic and changes no configuration, address, or author API. Existing cases render the same content, only sooner; browser-only cases keep working via fallback.

## Future work (out of scope for this change)

- **"Build production webapp" export.** With every address producing a complete document, a build command can crawl the catalog, render each address (cases × themes, placard, shell), and emit static HTML plus the adopt bundles needed for interactive surfaces — a hostable site that needs no live discovery server. That step will also need to reconcile the existing "Development-only tool" requirement (which forbids Display Case in *application* artifacts) with shipping Display Case's *own* optional hosted build; the cleanest reading is that the prohibition scopes to the product apps, and a Display Case site is its own artifact. That reconciliation belongs to the export change, not this one.
