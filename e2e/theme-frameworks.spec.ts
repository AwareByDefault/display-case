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

/** Read a component's computed color once it has rendered and painted. */
async function bgOf(
  page: import('@playwright/test').Page,
  testId: string,
): Promise<string> {
  const el = page.getByTestId(testId)
  await el.waitFor({ state: 'visible' })
  // Wait for a non-transparent background (browser-only components paint after the
  // client renders; SSR ones are already painted).
  await expect
    .poll(async () => el.evaluate((n) => getComputedStyle(n).backgroundColor))
    .not.toBe('rgba(0, 0, 0, 0)')
  return el.evaluate((n) => getComputedStyle(n).backgroundColor)
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
    await page.goto(`${BASE}/render/${c.id}/default?theme=light`, {
      waitUntil: 'domcontentloaded',
    })
    const light = await bgOf(page, c.testId)

    await page.goto(`${BASE}/render/${c.id}/default?theme=dark`, {
      waitUntil: 'domcontentloaded',
    })
    const dark = await bgOf(page, c.testId)

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
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  const light = await bgOf(page, 'ps-box')

  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  const dark = await bgOf(page, 'ps-box')

  expect(light).toBe('rgb(255, 255, 255)')
  expect(dark).toBe('rgb(0, 0, 0)')
})
