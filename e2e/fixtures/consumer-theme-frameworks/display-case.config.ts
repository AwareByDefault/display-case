import { defineConfig } from '@awarebydefault/display-case'

/**
 * A consumer fixture whose components come from REAL third-party frameworks
 * (installed as dev dependencies), each reading a different dark/light root
 * convention. It exercises the `theme.signals` config end-to-end: Display Case
 * emits every enabled signal on the document root, and each real component
 * re-themes off its own convention when the theme toggles.
 *
 * - `class` (default): Tailwind's class strategy — `dark:` variants under `.dark`.
 * - `bootstrap`: Bootstrap 5.3's `data-bs-theme`.
 * - `mui`: Material UI's CSS-variables `data-mui-color-scheme`.
 *
 * `globalStyles` loads the real, unmodified framework stylesheets: Bootstrap's
 * shipped CSS from `node_modules`, and a Tailwind stylesheet compiled from the
 * real `tailwindcss` CLI by the e2e global setup (see `e2e/theme-frameworks.setup.ts`).
 */
export default defineConfig({
  title: 'Theme Frameworks',
  roots: ['src/**/*.case.tsx'],
  theme: { signals: ['class', 'bootstrap', 'mui'] },
  globalStyles: [
    '../../../node_modules/bootstrap/dist/css/bootstrap.min.css',
    'tailwind.out.css',
  ],
})
