// Screenshot a Display Case component in the real shell (with the Stage frame,
// caption, corner ticks, tweaks panel) at one or more screen sizes.
//
// This drives the full browse UI — NOT the chrome-free /render endpoint — so it
// captures the stage chrome. For an isolated, chrome-free component snapshot use
// the `display-case-snapshot` skill instead.
//
// Prereqs: a Display Case server must be running, e.g.
//   bun run display-case            # this package's own cases   (port 3103)
//   bun run display-case-ui    # the Acme UI library        (port 3100)
//
// Usage:
//   bun .claude/skills/playwright/scripts/shoot-display-case.mjs \
//     --url=http://localhost:3100 --component=Button --sizes=Full,Laptop,Mobile \
//     --out=/tmp/dc
//
// Flags:
//   --url=        Display Case base URL            (default http://localhost:3100)
//   --component=  exact nav label to click         (default: leave current selection)
//   --sizes=      comma list of "Screen size" labels (default: Full)
//   --out=        output path prefix               (default /tmp/dc)
//   --viewport=   browser window WxH               (default 1400x900)
//   --selector=   element to capture               (default .dc-preview; use "page" for full page)

import { launchChromium } from './playwright-env.mjs'

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=')
    return [k, v.join('=')]
  }),
)

const url = args.url ?? 'http://localhost:3100'
const sizes = (args.sizes ?? 'Full').split(',').map((s) => s.trim())
const out = args.out ?? '/tmp/dc'
const [vw, vh] = (args.viewport ?? '1400x900').split('x').map(Number)
const selector = args.selector ?? '.dc-preview'

const browser = await launchChromium()
try {
  const page = await browser.newPage({ viewport: { width: vw, height: vh } })
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)

  if (args.component) {
    await page
      .getByText(args.component, { exact: true })
      .first()
      .click({ timeout: 4000 })
    await page.waitForTimeout(500)
  }

  const sizeSelect = page.getByLabel('Screen size')
  for (const label of sizes) {
    if (sizes.length > 1 || label !== 'Full') {
      await sizeSelect.selectOption({ label })
      await page.waitForTimeout(900)
    }
    const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const file = `${out}-${slug}.png`
    if (selector === 'page') await page.screenshot({ path: file })
    else await (await page.$(selector)).screenshot({ path: file })
    console.log('shot', file)
  }
} finally {
  await browser.close()
}
