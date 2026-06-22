import { defineConfig } from '@awarebydefault/display-case'

/**
 * A dummy consumer package for the a11y e2e suite: one component with a known,
 * deterministic accessibility violation (`Broken`) and one clean component
 * (`Clean`), with live in-app a11y surfacing turned on.
 */
export default defineConfig({
  title: 'A11y Consumer',
  roots: ['src/**/*.case.tsx'],
  a11y: { enabled: true },
})
