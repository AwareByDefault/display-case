---
"@awarebydefault/display-case": patch
---

Stability, speed, and bundle-size hardening (no public API change):

- **Dev-server speed:** a rebuild now reuses the surfaces a change can't have
  touched — a component *implementation* edit no longer re-runs the catalog-size
  manifest subprocess or rebuilds the chrome; the manifest, chrome build, and
  global-CSS read run concurrently; and overlapping rebuilds are coalesced instead
  of racing.
- **Stability:** the `.display-case/ssr` cache no longer grows unbounded (prior
  seq-named bundles are pruned per build and swept at startup); the interactive
  dev server tears down cleanly on SIGINT/SIGTERM (closes the a11y browser,
  unsubscribes watchers, kills in-flight build workers); the Playwright driver no
  longer leaks a page on a failed navigation and bounds navigation at 15s; the
  prod/dev static-asset handlers are hardened against path traversal; and
  `Bun.serve` returns a sanitized 500 on a handler throw.
- **Bundle size:** the npm tarball no longer ships tests, dogfood cases, placard
  docs, or fixtures (267 → 142 files); published SSR server bundles are minified.
- **Toolchain:** `noUncheckedIndexedAccess` and Biome's `noFloatingPromises` are
  enabled (a real unhandled doc-fetch rejection was fixed); `@types/react(-dom)`
  are declared optional peers; Dependabot and a `bun audit` CI job are added.
