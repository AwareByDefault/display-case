import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests for the Display Case browse chrome.
 *
 * Display Case is a self-contained dev tool, so its e2e suite is co-located here
 * and owns everything it needs: it launches the Display Case server itself via
 * `webServer` — pointed at this package, which dogfoods its own design system —
 * and drives it. No app stack or database is involved.
 *
 *   bun run e2e            # from the repo root
 *   bun run e2e:install    # one-time: install the Chromium browser
 *
 * The port is overridable for parallel/worktree runs; the default avoids the
 * dev server's 3103.
 */
const PORT = Number(process.env.DISPLAY_CASE_PORT ?? 3190)
const BASE_URL = `http://localhost:${PORT}`
// Two dummy consumer fixtures for the a11y suite: one with live a11y on (a known
// violation + a clean component), one with a11y off (the control). Exposed to
// the specs via env so they can address the fixture servers absolutely.
const A11Y_PORT = Number(process.env.DISPLAY_CASE_A11Y_PORT ?? PORT + 1)
const PLAIN_PORT = Number(process.env.DISPLAY_CASE_PLAIN_PORT ?? PORT + 2)
// A third consumer with `a11y.startup: 'refresh'` for the start-up population spec.
const STARTUP_PORT = Number(process.env.DISPLAY_CASE_STARTUP_PORT ?? PORT + 3)
// A consumer with a tall + a short tweaked case for the auto-undock spec.
const AUTODOCK_PORT = Number(process.env.DISPLAY_CASE_AUTODOCK_PORT ?? PORT + 4)
process.env.DISPLAY_CASE_A11Y_PORT = String(A11Y_PORT)
process.env.DISPLAY_CASE_PLAIN_PORT = String(PLAIN_PORT)
process.env.DISPLAY_CASE_STARTUP_PORT = String(STARTUP_PORT)
process.env.DISPLAY_CASE_AUTODOCK_PORT = String(AUTODOCK_PORT)

export default defineConfig({
  testDir: './e2e',
  // The suite is read-only — every spec just browses the showcase — so cases are
  // independent and safe to run fully in parallel.
  fullyParallel: true,
  retries: 0,
  timeout: 15_000,
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      // Serve this package's own showcase (`.` resolves the display-case.config.ts
      // at the package root); cwd defaults to this config's directory.
      command: `bun src/cli.ts . --port=${PORT}`,
      url: `${BASE_URL}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      // Dummy consumer with live a11y on + a known violation (a11y.spec.ts).
      command: `bun src/cli.ts e2e/fixtures/consumer --port=${A11Y_PORT}`,
      url: `http://localhost:${A11Y_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      // Dummy consumer with a11y off — the control fixture.
      command: `bun src/cli.ts e2e/fixtures/consumer-plain --port=${PLAIN_PORT}`,
      url: `http://localhost:${PLAIN_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      // Dummy consumer with `a11y.startup: 'refresh'` (a11y-startup.spec.ts).
      command: `bun src/cli.ts e2e/fixtures/consumer-startup --port=${STARTUP_PORT}`,
      url: `http://localhost:${STARTUP_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      // Consumer with a tall + a short tweaked case (auto-undock.spec.ts).
      command: `bun src/cli.ts e2e/fixtures/consumer-autodock --port=${AUTODOCK_PORT}`,
      url: `http://localhost:${AUTODOCK_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
})
