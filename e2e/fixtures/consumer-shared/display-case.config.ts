import { defineConfig } from '@awarebydefault/display-case'

/**
 * A consumer that declares a non-React runtime library (`markdown-to-jsx`) to be
 * shared across the published surfaces via `share`. Two components import it, so
 * without sharing it would inline a copy into each per-component bundle; with it
 * declared, the publish ships one vendor bundle every surface resolves to via the
 * importmap. Exercises the generalized shared-runtime path beyond React.
 */
export default defineConfig({
  title: 'Shared Consumer',
  roots: ['src/**/*.case.tsx'],
  share: ['markdown-to-jsx'],
  // A primer bundles `markdown-to-jsx` via an absolute path (the mdx plugin), whose
  // internals import the `markdown-to-jsx/entities` subpath. The publish must inline
  // that undeclared subpath, not externalize it past the importmap.
  primer: './primer.mdx',
})
