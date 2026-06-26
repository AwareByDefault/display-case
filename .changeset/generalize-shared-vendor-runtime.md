---
"@awarebydefault/display-case": minor
---

Publish: deliver shared runtime libraries once, beyond React (`config.share`)

A published showcase already ships React **once** (a shared vendor bundle every
surface references via an importmap) instead of inlining it into every per-component
bundle. That mechanism now generalizes: a new optional `share?: string[]` config lists
any further runtime library — a CSS-in-JS engine, `markdown-to-jsx`, a monorepo
workspace package — to deliver once the same way.

- One descriptor drives the externals, the vendor entrypoints, and the importmap, so
  they can't drift; the bounded vendor set is built in a single `splitting` pass that
  dedupes shared internals (the catalog stays one isolated build per component).
- Sharing a library also collapses it to a single instance — what a stateful library
  (a style cache/context) needs to behave correctly.
- Monorepo-aware: a published shared package is kept external on the SSR renderers and
  added to the generated `package.json`; a repo-internal workspace package is shared on
  the client but bundled into the SSR renderers (no registry coordinates).
- `display-case publish` now reports libraries inlined across more than one component
  as candidates for `share`.

No change for existing users: with nothing declared, React is still shared and the
output is unchanged.
