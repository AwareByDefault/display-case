import { expect, test } from '@playwright/test'
import { DcTestIds } from '../src/ui/test-ids'

/**
 * Start-up accessibility population (`a11y.startup: 'refresh'`), driven against
 * the `consumer-startup` fixture (booted as an extra `webServer`). The fixture
 * scans every uncached variant at boot, so the nav marker for the `Broken`
 * component must surface for a freshly-connected tab WITHOUT that component ever
 * being viewed — proving both the start-up scan burst and the `/a11y/known`
 * replay that seeds a late-joining client's nav.
 *
 * The first cold boot launches a browser and audits every variant, so allow a
 * generous timeout for the marker to land.
 */
const STARTUP = `http://localhost:${process.env.DISPLAY_CASE_STARTUP_PORT ?? 3193}`
const SCAN_TIMEOUT = 45_000

test.describe('start-up a11y population', () => {
  test.slow() // a real scan of every variant runs server-side at boot

  test('seeds the Broken nav marker without ever viewing that component', async ({
    page,
  }) => {
    // Land on the Clean component — never navigate to Broken.
    await page.goto(`${STARTUP}/c/clean/default`)
    await expect(page.getByTestId(DcTestIds.app)).toBeVisible()

    // The Broken marker appears purely from start-up population + the
    // `/a11y/known` replay, not from viewing the variant.
    await expect(page.getByTestId(DcTestIds.navAlert('broken'))).toBeVisible({
      timeout: SCAN_TIMEOUT,
    })
  })

  test('replays known verdicts to a tab that connects after the burst', async ({
    page,
  }) => {
    // Hit the known-verdicts endpoint directly: once the start-up burst has
    // scanned Broken, its verdict is replayable to any newly-connected client.
    await expect
      .poll(
        async () => {
          const rows = (await (
            await page.request.get(`${STARTUP}/a11y/known`)
          ).json()) as Array<{ component: string; status: string }>
          return rows.find((r) => r.component === 'broken')?.status ?? null
        },
        { timeout: SCAN_TIMEOUT },
      )
      .toBe('ok')
  })
})
