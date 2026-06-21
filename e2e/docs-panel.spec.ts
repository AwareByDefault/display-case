import { expect, test } from '@playwright/test'
import { DcTestIds } from '../src/ui/test-ids'
import { componentWithDoc, fetchManifest, gotoLibrary } from './helpers'

test.describe('documentation panel', () => {
  test('the Docs toggle opens and closes the placard-doc panel', async ({
    page,
    request,
  }) => {
    const m = await fetchManifest(request)
    const c = componentWithDoc(m)
    test.skip(!c, 'no component with a placard doc in this showcase')
    if (!c) return

    await gotoLibrary(page)
    await page.getByTestId(DcTestIds.navComponent(c.id)).click()

    const docsButton = page.getByTestId(DcTestIds.docsButton)
    const panel = page.getByTestId(DcTestIds.docPanel)

    await expect(docsButton).toBeVisible()
    await expect(panel).toBeHidden()

    await docsButton.click()
    await expect(panel).toBeVisible()
    // The fetched markdown renders into the panel (not stuck on "Loading…").
    await expect(panel).toContainText(/\w/)
    await expect(docsButton).toHaveAttribute('aria-pressed', 'true')

    await docsButton.click()
    await expect(panel).toBeHidden()
  })

  test('a ?docs=1 deep link opens the panel on load', async ({
    page,
    request,
  }) => {
    const m = await fetchManifest(request)
    const c = componentWithDoc(m)
    test.skip(!c, 'no component with a placard doc in this showcase')
    if (!c) return
    const cs = c.cases[0]
    if (!cs) throw new Error('doc component has no cases')

    await page.goto(`/c/${c.id}/${cs.id}?docs=1`)

    await expect(page.getByTestId(DcTestIds.app)).toBeVisible()
    await expect(page.getByTestId(DcTestIds.docPanel)).toBeVisible()
  })
})
