import { expect, test } from '@playwright/test'
import { DcTestIds } from '../src/ui/test-ids'

/**
 * Auto-undock of the tweaks controls panel, driven against the
 * `consumer-autodock` fixture (booted as an extra `webServer`): one component,
 * `Sizes`, with a `Short` case that fits beside a docked panel and a `Tall` case
 * far taller than the stage.
 *
 * While the viewer hasn't chosen a placement, the chrome picks docked vs.
 * floating per case by whether the exhibit fits with the panel docked. A manual
 * dock/undock then takes over for the rest of the page load and survives case
 * switches (client-side navigation), but a reload discards it.
 */
const APP = `http://localhost:${process.env.DISPLAY_CASE_AUTODOCK_PORT ?? 3194}`

const panel = (page: import('@playwright/test').Page) =>
  page.getByTestId(DcTestIds.tweaksPanel)

test.describe('tweaks panel auto-undock', () => {
  test('a tall case floats the panel; a short case docks it', async ({
    page,
  }) => {
    await page.goto(`${APP}/c/sizes/tall`)
    await expect(panel(page)).toHaveAttribute('data-mode', 'floating')

    await page.goto(`${APP}/c/sizes/short`)
    await expect(panel(page)).toHaveAttribute('data-mode', 'docked')
  })

  test('switching from a fitting to a tall case re-evaluates placement', async ({
    page,
  }) => {
    await page.goto(`${APP}/c/sizes/short`)
    await expect(panel(page)).toHaveAttribute('data-mode', 'docked')

    // Client-side navigation (no reload) — the per-case rule still applies.
    await page.getByTestId(DcTestIds.navCase('sizes', 'tall')).click()
    await expect(panel(page)).toHaveAttribute('data-mode', 'floating')
  })

  test('an explicit choice persists across case switches', async ({ page }) => {
    // The tall case floats by default; dock it explicitly (the opposite of the
    // automatic choice) so a persisted docked panel proves the override, not the
    // size rule.
    await page.goto(`${APP}/c/sizes/tall`)
    await expect(panel(page)).toHaveAttribute('data-mode', 'floating')
    await page.getByTestId(DcTestIds.tweaksDockToggle).click()
    await expect(panel(page)).toHaveAttribute('data-mode', 'docked')

    // Navigate away and back: the size rule would re-float the tall case, but the
    // viewer's explicit dock must win.
    await page.getByTestId(DcTestIds.navCase('sizes', 'short')).click()
    await expect(panel(page)).toHaveAttribute('data-mode', 'docked')
    await page.getByTestId(DcTestIds.navCase('sizes', 'tall')).click()
    await expect(panel(page)).toHaveAttribute('data-mode', 'docked')
  })

  test('reloading discards an explicit choice', async ({ page }) => {
    // Tall floats by default; dock it explicitly, then reload.
    await page.goto(`${APP}/c/sizes/tall`)
    await expect(panel(page)).toHaveAttribute('data-mode', 'floating')
    await page.getByTestId(DcTestIds.tweaksDockToggle).click()
    await expect(panel(page)).toHaveAttribute('data-mode', 'docked')

    await page.reload()
    // The override is in-memory only, so the tall case is placed by size again.
    await expect(panel(page)).toHaveAttribute('data-mode', 'floating')
  })
})
