import { $ } from 'bun'

/**
 * Record the visual-regression baselines committed under `test/visual-baselines`
 * (see display-case.config.ts `baselineDir`).
 *
 * Pixel baselines are platform-sensitive — fonts and antialiasing differ between
 * macOS and the Linux CI runner — so they MUST be recorded in the *same*
 * environment CI renders in. CI runs the visual job inside the pinned Playwright
 * container (see .github/workflows/ci.yml), so this script records inside that
 * exact image via Docker. Running `display-case check --visual --update` on a
 * developer's Mac would commit baselines that CI can never match.
 *
 *   bun run baselines:record      # re-record every baseline (after an intended
 *                                 # visual change), then review + commit the diff
 *
 * Requires Docker. The repo is bind-mounted; an anonymous volume masks
 * node_modules so the container's Linux install never clobbers the host's.
 */

// Keep in lockstep with the `playwright` version in bun.lock and the container
// tag in .github/workflows/ci.yml — the browser build must match across all
// three or baselines and CI renders diverge.
const PLAYWRIGHT_IMAGE = 'mcr.microsoft.com/playwright:v1.61.0-noble'

const docker = await $`docker info`.nothrow().quiet()
if (docker.exitCode !== 0) {
  console.error('✗ Docker is required to record Linux-matched baselines.')
  console.error('  Start Docker and retry: bun run baselines:record')
  process.exit(1)
}

const repo = process.cwd()
console.log(`→ recording baselines in ${PLAYWRIGHT_IMAGE}`)

const inContainer = [
  'set -e',
  // Bun is not in the Playwright image; fetch it for this one-shot run. Its
  // installer needs unzip, which the image also lacks.
  'apt-get update >/dev/null 2>&1 && apt-get install -y unzip >/dev/null 2>&1',
  'curl -fsSL https://bun.sh/install | bash >/dev/null 2>&1',
  'export BUN_INSTALL=$HOME/.bun',
  'export PATH=$BUN_INSTALL/bin:$PATH',
  'bun install --frozen-lockfile',
  // Render every case and (re)write its baseline; no diff, so this never fails
  // on a changed render — that is the point of re-recording.
  'bun src/cli.ts check . --visual --update',
].join(' && ')

const run =
  await $`docker run --rm -v ${repo}:/work -v /work/node_modules -w /work ${PLAYWRIGHT_IMAGE} bash -lc ${inContainer}`.nothrow()

if (run.exitCode !== 0) process.exit(run.exitCode)
console.log('\n✓ baselines recorded under test/visual-baselines/')
console.log('  Review the diff, then commit the updated PNGs.')
