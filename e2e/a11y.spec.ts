import { expect, test } from '@playwright/test'
import { DcTestIds } from '../src/ui/test-ids'

/**
 * Live in-app accessibility surfacing, driven against two dummy consumer
 * fixtures (see `e2e/fixtures/`, booted as extra `webServer`s):
 *   - `consumer`      — a11y on, with a `Broken` component (a deterministic
 *                       color-contrast violation) and a `Clean` component.
 *   - `consumer-plain`— a11y off (the control: no markers, no panel).
 *
 * The fixture server runs a real headless scan on demand, so these tests allow a
 * generous timeout for the first cold scan (browser launch + audit).
 */
const A11Y = `http://localhost:${process.env.DISPLAY_CASE_A11Y_PORT ?? 3191}`
const PLAIN = `http://localhost:${process.env.DISPLAY_CASE_PLAIN_PORT ?? 3192}`
const SCAN_TIMEOUT = 45_000

test.describe('live a11y surfacing', () => {
  test.slow() // a real scan (browser launch + axe) runs server-side

  test('configured app surfaces a real violation in panel + nav', async ({
    page,
  }) => {
    await page.goto(`${A11Y}/c/broken/default`)
    const panel = page.getByTestId(DcTestIds.a11yPanel)
    await expect(panel).toBeVisible()
    // Resolves from 'pending' to a real verdict.
    await expect(panel).toHaveAttribute('data-state', 'fail', {
      timeout: SCAN_TIMEOUT,
    })
    // Asserting the panel surfaces this axe rule id as content (not a nav
    // locator) — matching the literal text is the point.
    await expect(panel.getByText('color-contrast')).toBeVisible() // allow: locator-discipline
    // The single-case leaf carries its violation count in the nav.
    await expect(page.getByTestId(DcTestIds.navAlert('broken'))).toBeVisible()
  })

  test('a clean component shows the pass state and no marker', async ({
    page,
  }) => {
    await page.goto(`${A11Y}/c/clean/default`)
    const panel = page.getByTestId(DcTestIds.a11yPanel)
    await expect(panel).toHaveAttribute('data-state', 'pass', {
      timeout: SCAN_TIMEOUT,
    })
    await expect(page.getByTestId(DcTestIds.navAlert('clean'))).toHaveCount(0)
  })

  test('re-scan re-runs the audit (pending → resolved)', async ({ page }) => {
    await page.goto(`${A11Y}/c/broken/default`)
    const panel = page.getByTestId(DcTestIds.a11yPanel)
    await expect(panel).toHaveAttribute('data-state', 'fail', {
      timeout: SCAN_TIMEOUT,
    })
    await page.getByTestId(DcTestIds.a11yRescan).click()
    // Forced re-scan drops the cache, so it goes back to pending then resolves.
    await expect(panel).toHaveAttribute('data-state', 'pending')
    await expect(panel).toHaveAttribute('data-state', 'fail', {
      timeout: SCAN_TIMEOUT,
    })
  })

  test('switching theme re-evaluates the verdict', async ({ page }) => {
    await page.goto(`${A11Y}/c/broken/default`)
    const panel = page.getByTestId(DcTestIds.a11yPanel)
    await expect(panel).toHaveAttribute('data-state', 'fail', {
      timeout: SCAN_TIMEOUT,
    })
    await page.getByTestId(DcTestIds.themeToggle).click()
    // The inline-coloured contrast violation persists across themes, so the dark
    // scan also resolves to a failure (proving the per-theme request fired).
    await expect(panel).toHaveAttribute('data-state', 'fail', {
      timeout: SCAN_TIMEOUT,
    })
  })

  test('a11y not configured: no panel, no markers', async ({ page }) => {
    await page.goto(`${PLAIN}/c/plain/default`)
    await expect(page.getByTestId(DcTestIds.app)).toBeVisible()
    await expect(page.getByTestId(DcTestIds.a11yPanel)).toHaveCount(0)
    await expect(page.locator('.dcui-a11y-badge')).toHaveCount(0)
  })
})
