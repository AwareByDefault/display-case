import { expect, test } from '@playwright/test'
import { DcTestIds } from '../src/ui/test-ids'
import { fetchManifest } from './helpers'

test.describe('browse chrome', () => {
  test('loads the shell with the showcase title and nav rail', async ({
    page,
    request,
  }) => {
    const m = await fetchManifest(request)
    await page.goto('/')

    await expect(page.getByTestId(DcTestIds.app)).toBeVisible()
    // The wordmark shows the configured title.
    await expect(page.getByTestId(DcTestIds.wordmark)).toHaveText(m.title)
    await expect(page.getByTestId(DcTestIds.sidebar)).toBeVisible()
  })

  test('the theme toggle flips the app theme and its own label', async ({
    page,
  }) => {
    await page.goto('/')
    const app = page.getByTestId(DcTestIds.app)
    const toggle = page.getByTestId(DcTestIds.themeToggle)
    await expect(app).toBeVisible()

    // Default theme is light; the toggle offers the other theme as its label.
    await expect(app).toHaveAttribute('data-theme', 'light')
    await expect(toggle).toHaveText('Dark')

    await toggle.click()
    await expect(app).toHaveAttribute('data-theme', 'dark')
    // The theme is also driven onto <html> so the surrounding page is themed.
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    // …and the user-agent color scheme tracks it so scrollbars / default control
    // chrome re-theme with the page (spec scenario 3, the interactive switch).
    await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark')
    await expect(toggle).toHaveText('Light')

    await toggle.click()
    await expect(app).toHaveAttribute('data-theme', 'light')
    await expect(page.locator('html')).toHaveCSS('color-scheme', 'light')
  })
})
