import { expect, test } from '@playwright/test'
import { DcTestIds } from '../src/ui/test-ids'

/**
 * Imported static assets, driven against the `consumer-asset` fixture (booted as
 * an extra `webServer`): one component, `Asset`, that imports an SVG and renders
 * it as an `<img src>` and a CSS `background-image`.
 *
 * The regression this guards: the bundler used to rewrite a `file`-loader import
 * to a *document-relative* URL that resolved against `/render/<component>/…` and
 * 404'd, so the image showed broken in the isolated render and the browse chrome.
 * The fix passes `publicPath` to every build so the URL points at the serving
 * mount. A unit test asserts the emitted URL string; this asserts the image
 * actually decodes in a real browser (`naturalWidth > 0`) on both surfaces.
 *
 * The rendered case is consumer *content*, not browse chrome, so it carries no
 * `DcTestIds`. Like `navigation.spec.ts`, it is located structurally through the
 * render document's `#root` (the chrome is reached via `DcTestIds`).
 */
const APP = `http://localhost:${process.env.DISPLAY_CASE_ASSET_PORT ?? 3195}`

/** The intrinsic width a decoded image reports; 0 means it never loaded. */
const naturalWidth = (el: HTMLImageElement) => el.naturalWidth

test.describe('imported static assets', () => {
  test('the isolated render serves an image that resolves and decodes', async ({
    page,
  }) => {
    await page.goto(`${APP}/render/asset/image`)

    const img = page.locator('#root img')
    await expect(img).toBeVisible()
    // The src points at the `/dist/` mount (the publicPath fix), not a
    // document-relative URL that would resolve against `/render/asset/…`.
    await expect(img).toHaveAttribute('src', /^\/dist\/mark-[A-Za-z0-9]+\.svg$/)
    // And it actually loaded: a broken image reports naturalWidth 0.
    await expect.poll(() => img.evaluate(naturalWidth)).toBeGreaterThan(0)
  })

  test('the asset also resolves when used as a CSS background-image', async ({
    page,
  }) => {
    await page.goto(`${APP}/render/asset/background`)
    const bg = page.locator('#root > div')
    await expect(bg).toBeVisible()

    // The same rewritten URL is consumed in `url(...)`. Assert the *resolved*
    // background-image points at the `/dist/` mount — not a document-relative
    // path (`/render/asset/mark-…`), which the dev server answers with the SPA
    // shell (HTTP 200 HTML), so the background silently breaks without a 404.
    const bgUrl = await bg.evaluate(
      (el) => getComputedStyle(el).backgroundImage,
    )
    expect(bgUrl).toMatch(/\/dist\/mark-[A-Za-z0-9]+\.svg/)
    expect(bgUrl).not.toContain('/render/')

    // And the served bytes are an image, not the shell HTML a wrong path returns.
    const assetUrl = bgUrl.replace(/^url\(["']?/, '').replace(/["']?\)$/, '')
    const res = await page.request.get(assetUrl)
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toContain('image/svg')
  })

  test('the image loads inside the browse chrome stage', async ({ page }) => {
    // The real visual-review path: the case renders on the Stage (an iframe).
    await page.goto(`${APP}/c/asset/image`)
    await expect(page.getByTestId(DcTestIds.stageFrame)).toBeVisible()
    const img = page
      .frameLocator(`[data-testid="${DcTestIds.stageFrame}"]`)
      .locator('#root img')
    await expect(img).toBeVisible()
    await expect.poll(() => img.evaluate(naturalWidth)).toBeGreaterThan(0)
  })
})
