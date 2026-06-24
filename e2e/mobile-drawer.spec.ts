import { expect, test } from '@playwright/test'
import { DcTestIds } from '../src/ui/test-ids'
import { fetchManifest, firstComponent } from './helpers'

test.describe('mobile nav drawer', () => {
  test.use({ viewport: { width: 390, height: 780 } })

  test('opens as a full-width drawer and closes on select', async ({
    page,
    request,
  }) => {
    const m = await fetchManifest(request)
    const c = firstComponent(m)
    const first = c.cases[0]
    if (!first) throw new Error('first component has no cases')

    // A kit-case deep link lands in Components mode; on a phone the nav starts
    // collapsed (hidden) so the stage gets the whole screen.
    await page.goto(first.browseUrl)
    const app = page.getByTestId(DcTestIds.app)
    await expect(app).toBeVisible()
    await expect(app).toHaveAttribute('data-nav', 'collapsed')
    const sidebar = page.getByTestId(DcTestIds.sidebar)
    await expect(sidebar).toBeHidden()

    // ☰ opens it as a full-width drawer over the stage.
    await page.getByTestId(DcTestIds.navToggle).click()
    await expect(app).toHaveAttribute('data-nav', 'open')
    await expect(sidebar).toBeVisible()
    const railW = await sidebar.evaluate((el) => el.clientWidth)
    expect(railW).toBeGreaterThan(386) // ~full 390px viewport width

    // Choosing a component closes the drawer so the selection is visible.
    await page.getByTestId(DcTestIds.navComponent(c.id)).click()
    await expect(app).toHaveAttribute('data-nav', 'collapsed')
    await expect(sidebar).toBeHidden()
  })
})
