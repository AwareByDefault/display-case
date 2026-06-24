import { expect, test } from '@playwright/test'
import { DcTestIds } from '../src/ui/test-ids'
import { gotoLibrary } from './helpers'

const railWidth = (page: import('@playwright/test').Page) =>
  page.getByTestId(DcTestIds.sidebar).evaluate((el) => el.clientWidth)

test.describe('sidebar resize', () => {
  test('dragging the right edge widens the rail and persists across reload', async ({
    page,
  }) => {
    await gotoLibrary(page)
    const before = await railWidth(page)

    const handle = page.getByTestId(DcTestIds.sidebarResize)
    await expect(handle).toBeVisible()
    const box = await handle.boundingBox()
    if (!box) throw new Error('resize handle has no box')
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + 140, box.y + box.height / 2, { steps: 12 })
    await page.mouse.up()

    // The rail widens and the width is remembered.
    await expect.poll(() => railWidth(page)).toBeGreaterThan(before + 80)
    const after = await railWidth(page)
    const stored = await page.evaluate(() =>
      Number(window.localStorage.getItem('dc-sidebar-w')),
    )
    expect(stored).toBeGreaterThan(before + 80)

    // …and restored after a reload (allow a 1px rounding tolerance).
    await page.reload()
    await expect(page.getByTestId(DcTestIds.app)).toBeVisible()
    await expect.poll(() => railWidth(page)).toBeLessThanOrEqual(after + 1)
    expect(await railWidth(page)).toBeGreaterThanOrEqual(after - 1)
  })

  test('keyboard arrows on the handle resize the rail', async ({ page }) => {
    await gotoLibrary(page)
    const before = await railWidth(page)
    await page.getByTestId(DcTestIds.sidebarResize).focus()
    for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight')
    expect(await railWidth(page)).toBeGreaterThan(before)
  })
})
