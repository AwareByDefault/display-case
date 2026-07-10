import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Playwright global setup: compile the theme-frameworks fixture's Tailwind
 * stylesheet with the REAL `tailwindcss` CLI before the fixture server starts, so
 * the class-strategy `dark:` rules the Tailwind case relies on exist. Runs once,
 * before any `webServer`. The output is gitignored (a build artifact). Uses
 * portable Node APIs so it works whichever runtime executes the Playwright config.
 */
export default async function globalSetup(): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url))
  const repoRoot = dirname(here)
  const dir = join(here, 'fixtures', 'consumer-theme-frameworks')
  const bin = join(repoRoot, 'node_modules', '.bin', 'tailwindcss')
  execFileSync(
    bin,
    [
      '--input',
      join(dir, 'tailwind.in.css'),
      '--output',
      join(dir, 'tailwind.out.css'),
    ],
    { stdio: 'inherit' },
  )
}
