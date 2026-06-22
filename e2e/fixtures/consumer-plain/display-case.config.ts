import { defineConfig } from '@awarebydefault/display-case'

/**
 * A dummy consumer package WITHOUT a11y configured — the control case for the
 * e2e suite: the chrome must show no accessibility markers and no panel.
 */
export default defineConfig({
  title: 'Plain Consumer',
  roots: ['src/**/*.case.tsx'],
})
