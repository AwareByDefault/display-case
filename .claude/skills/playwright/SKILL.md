---
name: playwright
description: Locate and run Playwright in this repo to drive a headless Chromium — screenshot Display Case components or the running app, scrape rendered DOM, browser-test a change. Use whenever you need to drive a browser and hit "Cannot find package 'playwright'", a missing/version-mismatched browser executable, or are unsure where Playwright lives. Pairs with display-case-snapshot (chrome-free single component) when you instead need the full shell with the Stage frame.
---

# Driving Playwright in this repo

Two things trip people up here. This skill removes both.

## The two gotchas

1. **Where Playwright lives.** It is **not** a root dependency. It's an
   `optionalDependency` of `packages/display-case`, installed only at
   `packages/display-case/node_modules/playwright`. A bare `import 'playwright'`
   therefore resolves **only** for scripts physically located under that
   package. A script anywhere else in the repo fails with
   `Cannot find package 'playwright'`. (Running a script from `/tmp` may appear
   to work because Bun auto-installs it from the registry — non-deterministic,
   needs network, and can grab a different version. Don't rely on that.)

2. **The browser binary.** Playwright's default `launch()` uses a *headless
   shell* whose pinned version can drift from the build actually present in the
   browser cache, so it errors with
   `Executable doesn't exist at .../chrome-headless-shell-<N>/...`. The fix is to
   launch with an **explicit** `executablePath` pointing at an installed build.

## The fix: always go through `playwright-env.mjs`

[scripts/playwright-env.mjs](scripts/playwright-env.mjs) solves both, with **no
developer-specific hard-coded paths** (it finds the repo root via `.git`, loads
Playwright via `createRequire` anchored at the owning package, and resolves a
real browser binary dynamically — works on any machine / OS).

Import it from a script placed **anywhere in the repo**:

```js
import { launchChromium } from '<rel-path>/.claude/skills/playwright/scripts/playwright-env.mjs'

const browser = await launchChromium() // headless, explicit executable, no path hunting
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
await page.goto('http://localhost:3100/', { waitUntil: 'networkidle' })
// ... drive the page ...
await browser.close()
```

It also exports `chromium`, `firefox`, `webkit`, `devices`, and
`resolveChromiumPath()` (the verified executable path) if you need the raw API.

Run scripts with **bun** (project convention):

```bash
bun path/to/your-script.mjs
```

If the resolver reports no browser is installed, it tells you the exact command;
the canonical one is:

```bash
cd packages/display-case && bunx playwright install chromium
```

## Common task: screenshot a Display Case component (full shell)

Use the ready-made [scripts/shoot-display-case.mjs](scripts/shoot-display-case.mjs).
It drives the real browse UI, so you capture the **Stage frame, caption, corner
ticks and tweaks panel** — unlike the chrome-free `/render` endpoint that the
`display-case-snapshot` skill uses.

1. Start a Display Case server (leave it running, then **stop it when done**):
   - `bun run display-case` — this package's own cases (port **3103**)
   - `bun run display-case-ui` — the Acme UI library (port **3100**)
2. Shoot:

```bash
bun .claude/skills/playwright/scripts/shoot-display-case.mjs \
  --url=http://localhost:3100 --component=Button --sizes=Full,Laptop,Mobile --out=/tmp/dc
```

Then `Read` the resulting `/tmp/dc-*.png` files.

Flags: `--url`, `--component` (exact nav label), `--sizes` (comma list of
"Screen size" labels — `Full`, `Desktop`, `Tablet`, `Mobile`, `Laptop`,
`iPhone 15`, …), `--out` (path prefix), `--viewport=WxH`, `--selector` (element
to capture; default `.dc-preview`, or `page` for the whole page).

## Writing your own one-off script

Copy this template (adjust the relative path to `playwright-env.mjs` for where
you save it):

```js
import { launchChromium } from './.claude/skills/playwright/scripts/playwright-env.mjs'

const browser = await launchChromium()
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  await page.goto(process.env.URL ?? 'http://localhost:3100/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  // interact: page.getByRole(...), page.getByLabel(...), page.click(...), etc.
  await page.screenshot({ path: '/tmp/shot.png' })
} finally {
  await browser.close() // always close — don't leak browser processes
}
```

## Notes

- Always `await browser.close()` (use `try/finally`) so headless processes don't
  leak. Likewise stop any Display Case dev server you started.
- `getByLabel('Screen size')` is the size `<select>`; `getByText(label,{exact:true})`
  selects a component in the nav. Inspect available options with
  `page.$$eval('select', els => els.map(e => ({aria: e.getAttribute('aria-label'), opts:[...e.options].map(o=>o.textContent)})))`.
- For an isolated, chrome-free single-component image (no Stage frame), prefer
  the `display-case-snapshot` skill instead of this.
