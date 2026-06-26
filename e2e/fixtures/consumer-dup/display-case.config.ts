import { defineConfig } from '@awarebydefault/display-case'

/**
 * The same two `markdown-to-jsx`-importing components as `consumer-shared`, but
 * WITHOUT declaring `share`. Publishing it inlines the library into both
 * per-component bundles, so the advisory duplicate report should name it as a
 * candidate for `share`. The control for the duplicate-runtime reporting.
 */
export default defineConfig({
  title: 'Dup Consumer',
  roots: ['src/**/*.case.tsx'],
})
