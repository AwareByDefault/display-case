import { expect, test } from '@playwright/test'

/**
 * Proves Display Case's theme signals actually drive REAL framework components —
 * not merely that the attributes/classes appear. Each case is a real component
 * from a dev-dependency framework reading a different root convention; we render
 * it chrome-free under each theme and assert its computed style changes, so the
 * library must have re-themed off Display Case's signal.
 *
 * Rendering per-theme via the `/render` endpoint covers both the server-baked
 * first paint and the client's application of the same signal set.
 */
const PORT = Number(process.env.DISPLAY_CASE_FRAMEWORKS_PORT ?? 3196)
const BASE = `http://localhost:${PORT}`
const TRANSPARENT = 'rgba(0, 0, 0, 0)'

/**
 * Navigate to a render URL and return the component's computed background once it
 * is actually styled — retrying the navigation, not just polling.
 *
 * The framework CSS (Tailwind/Bootstrap) is inlined into the `/render` document at
 * request time from `globalStyles`. The dev server starts listening before its
 * initial build populates `globalCss`, so under cold-start contention an early
 * request can be served *before* the stylesheet is ready — the component then has
 * no background rule (transparent), and since the CSS is per-document, polling the
 * same page won't recover. Re-navigating does, once the build has landed. So we
 * gate readiness on a non-transparent background across reloads.
 */
async function loadBg(
  page: import('@playwright/test').Page,
  url: string,
  testId: string,
): Promise<string> {
  let bg = TRANSPARENT
  await expect(async () => {
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    const el = page.getByTestId(testId)
    await el.waitFor({ state: 'visible' })
    bg = await el.evaluate((n) => getComputedStyle(n).backgroundColor)
    expect(bg).not.toBe(TRANSPARENT)
  }).toPass({ timeout: 15_000 })
  return bg
}

const rootConventionCases = [
  { name: 'Tailwind (class)', id: 'tailwind-box', testId: 'tw-box' },
  {
    name: 'Bootstrap (data-bs-theme)',
    id: 'bootstrap-card',
    testId: 'bs-card',
  },
  { name: 'MUI (data-mui-color-scheme)', id: 'mui-paper', testId: 'mui-paper' },
] as const

for (const c of rootConventionCases) {
  test(`${c.name} re-themes with Display Case's theme signal`, async ({
    page,
  }) => {
    const light = await loadBg(
      page,
      `${BASE}/render/${c.id}/default?theme=light`,
      c.testId,
    )
    const dark = await loadBg(
      page,
      `${BASE}/render/${c.id}/default?theme=dark`,
      c.testId,
    )

    // The real component's surface changed with the theme — it followed the signal.
    expect(dark).not.toBe(light)
  })
}

test('a prefers-color-scheme-only component is captured in the requested theme', async ({
  page,
}) => {
  // This component themes ONLY via `@media (prefers-color-scheme)`, which a served
  // page cannot set — so Display Case's INTERACTIVE toggle can't drive it. But the
  // capture/audit driver emulates the color-scheme preference; mirror that here to
  // prove the component renders in the requested theme during capture.
  const url = `${BASE}/render/prefers-color-scheme-box/default`

  await page.emulateMedia({ colorScheme: 'light' })
  const light = await loadBg(page, url, 'ps-box')

  await page.emulateMedia({ colorScheme: 'dark' })
  const dark = await loadBg(page, url, 'ps-box')

  expect(light).toBe('rgb(255, 255, 255)')
  expect(dark).toBe('rgb(0, 0, 0)')
})
