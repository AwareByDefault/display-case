import { defineConfig } from '@awarebydefault/display-case'
import { domSubstrate } from '@awarebydefault/display-case/substrate'

/**
 * A consumer whose substrate declares a **render axis beyond theme**.
 *
 * The built-in DOM substrate declares only `theme` (render) and `viewport`
 * (stage), so nothing in this repo otherwise exercises the chrome's generic
 * per-axis control or the address encoding for an axis Display Case knows
 * nothing about. This fixture supplies one — `density` — so that path has proof
 * of life in the e2e suite rather than being reachable only in principle.
 *
 * It wraps the DOM substrate rather than replacing it: the rendering stays
 * ordinary HTML (the axis does not change what `render()` produces here), which
 * keeps the fixture about the *chrome and address* plumbing under test.
 */
const base = domSubstrate()

export default defineConfig({
  title: 'Substrate Consumer',
  roots: ['src/**/*.case.tsx'],
  substrate: {
    ...base,
    variants: [
      ...base.variants,
      {
        id: 'density',
        label: 'Density',
        kind: 'render',
        values: [
          { value: 'comfortable', label: 'Comfortable' },
          { value: 'compact', label: 'Compact' },
        ],
        default: 'comfortable',
      },
    ],
  },
})
