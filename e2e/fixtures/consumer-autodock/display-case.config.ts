import { defineConfig } from '@awarebydefault/display-case'

/**
 * A dummy consumer for the tweaks auto-undock spec (auto-undock.spec.ts). It
 * ships one component with two tweaked cases — a deliberately tall one (taller
 * than the stage) and a short one — so the chrome's per-case docked/floating
 * decision is exercised deterministically, independent of the dogfooded design
 * system's evolving component sizes.
 */
export default defineConfig({
  title: 'Auto-undock Consumer',
  roots: ['src/**/*.case.tsx'],
})
