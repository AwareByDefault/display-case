import { $ } from 'bun'

/**
 * First-time setup for the Display Case repo.
 *
 * Idempotent — safe to re-run; each step reports `✓` when already satisfied.
 * Display Case is a self-contained dev tool, so there is no Docker, no service
 * stack, and no `.env` to provision (contrast the host monorepo's setup,
 * which bootstraps a service stack and an env file). The only prerequisites
 * are the package dependencies and the Chromium browser the Playwright e2e suite
 * drives.
 */

async function ensureBun() {
  const bun = await $`bun --version`.nothrow().quiet()
  if (bun.exitCode === 0) {
    console.log(`✓ bun ${bun.stdout.toString().trim()}`)
    return
  }
  // We are running under `bun scripts/setup.ts`, so this is practically
  // unreachable — but keep the message honest for anyone porting the script.
  console.error('✗ Bun is required. Install it: https://bun.sh')
  process.exit(1)
}

async function ensureDeps() {
  console.log('→ bun install')
  const install = await $`bun install`.nothrow()
  if (install.exitCode !== 0) process.exit(install.exitCode)
  console.log('✓ dependencies')
}

async function ensureChromium() {
  // `playwright install` is itself idempotent — it skips an already-installed
  // browser — so just run it and surface any failure. This is the e2e
  // equivalent of the host-monorepo setup's Docker check: the one external binary the
  // test suite can't run without.
  console.log('→ playwright install chromium (e2e browser)')
  const install = await $`bun run e2e:install`.nothrow()
  if (install.exitCode !== 0) {
    console.error('✗ failed to install the Chromium browser for Playwright.')
    console.error('  Retry on its own with: bun run e2e:install')
    process.exit(install.exitCode)
  }
  console.log('✓ chromium (Playwright e2e browser)')
}

await ensureBun()
await ensureDeps()
await ensureChromium()

console.log('\n✓ Setup complete.')
console.log('  Browse:  bun dev          (live-reloading showcase)')
console.log('  Check:   bun run check    (structure + tokens + ssr)')
console.log('  Test:    bun test         ·  bun run e2e')
