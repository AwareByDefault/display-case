import { defineConfig } from 'display-case'

/**
 * A dummy consumer for the start-up population e2e: same Broken/Clean components
 * as `consumer`, but with `a11y.startup: 'refresh'` so the server scans every
 * uncached variant at boot and seeds the nav. The test connects fresh and
 * asserts the `Broken` marker appears WITHOUT ever visiting that component —
 * proving the start-up burst plus the `/a11y/known` replay for a late-joining tab.
 */
export default defineConfig({
  title: 'A11y Start-up Consumer',
  roots: ['src/**/*.case.tsx'],
  a11y: { enabled: true, startup: 'refresh' },
})
