import { expect, test } from '@playwright/test'
import { DcTestIds } from '../src/ui/test-ids'
import { componentWithCases, fetchManifest, firstComponent } from './helpers'

test.describe('Primer / Cases mode switch', () => {
  test('lands on the Primer and switches between the two views', async ({
    page,
    request,
  }) => {
    const m = await fetchManifest(request)
    test.skip(!m.primer, 'this showcase has no Primer configured')
    const c = firstComponent(m)
    const firstCase = c.cases[0]
    if (!firstCase) throw new Error('first component has no cases')

    await page.goto('/')
    await expect(page.getByTestId(DcTestIds.app)).toBeVisible()

    const primerTab = page.getByTestId(DcTestIds.modeSwitch('primer'))
    const casesTab = page.getByTestId(DcTestIds.modeSwitch('library'))
    const componentNav = page.getByTestId(DcTestIds.navComponent(c.id))

    // The Primer is the default landing view at "/": its tab is selected, the
    // component tree (a library-only view) is not shown, and the address is "/".
    await expect(primerTab).toHaveAttribute('aria-selected', 'true')
    await expect(componentNav).toBeHidden()
    await expect(page).toHaveURL(/\/$/)

    // Switch to Cases → the component tree appears and the address becomes the
    // exhibit's deep link (so the mode is a real navigation step, not view-only).
    await casesTab.click()
    await expect(casesTab).toHaveAttribute('aria-selected', 'true')
    await expect(componentNav).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`/c/${c.id}/${firstCase.id}$`))

    // Switch back to the Primer → the component tree is hidden and the address
    // is the canonical "/primer" (the reserved Primer route).
    await primerTab.click()
    await expect(primerTab).toHaveAttribute('aria-selected', 'true')
    await expect(componentNav).toBeHidden()
    await expect(page).toHaveURL(/\/primer$/)
  })

  test('returns to the exhibit you were on when toggling back to Cases', async ({
    page,
    request,
  }) => {
    const m = await fetchManifest(request)
    test.skip(!m.primer, 'this showcase has no Primer configured')
    const c = componentWithCases(m)
    test.skip(!c, 'no component with multiple cases to navigate to')
    if (!c) return
    const target = c.cases[1]
    if (!target) throw new Error('component has no second case')

    const primerTab = page.getByTestId(DcTestIds.modeSwitch('primer'))
    const casesTab = page.getByTestId(DcTestIds.modeSwitch('library'))

    // Land on the Primer, switch to Cases, then navigate to a specific case.
    await page.goto('/')
    await casesTab.click()
    await page.getByTestId(DcTestIds.navCase(c.id, target.id)).click()
    await expect(page).toHaveURL(new RegExp(`/c/${c.id}/${target.id}$`))

    // Go to the Primer, then back to Cases: we land on the *same* exhibit, not
    // a reset to the first case — the selection survives the round trip.
    await primerTab.click()
    await expect(page).toHaveURL(/\/primer$/)
    await casesTab.click()
    await expect(page).toHaveURL(new RegExp(`/c/${c.id}/${target.id}$`))
  })

  test('serves the Primer document at the reserved /render/primer, and the SPA at /primer', async ({
    request,
  }) => {
    const m = await fetchManifest(request)
    test.skip(!m.primer, 'this showcase has no Primer configured')

    // The chrome-free Primer document lives under the reserved /render/primer.
    const doc = await request.get('/render/primer')
    expect(doc.ok(), `GET /render/primer → ${doc.status()}`).toBe(true)
    const docHtml = await doc.text()
    expect(docHtml).toContain('/dist/primer-entry.js')
    // It must NOT be the generic component-render document.
    expect(docHtml).not.toContain('/dist/render-entry.js')

    // The browse-route /primer is handled by the SPA shell (client-side
    // routing), so a deep link / refresh there boots the chrome, not the doc.
    const spa = await request.get('/primer')
    expect(spa.ok(), `GET /primer → ${spa.status()}`).toBe(true)
    expect(await spa.text()).toContain('/dist/browser-entry.js')
  })

  test('a /primer deep link boots straight into the Primer view', async ({
    page,
    request,
  }) => {
    const m = await fetchManifest(request)
    test.skip(!m.primer, 'this showcase has no Primer configured')

    await page.goto('/primer')
    await expect(page.getByTestId(DcTestIds.app)).toBeVisible()
    await expect(
      page.getByTestId(DcTestIds.modeSwitch('primer')),
    ).toHaveAttribute('aria-selected', 'true')
    await expect(page).toHaveURL(/\/primer$/)
  })

  test('back/forward cross the Primer ↔ Cases boundary', async ({
    page,
    request,
  }) => {
    const m = await fetchManifest(request)
    test.skip(!m.primer, 'this showcase has no Primer configured')
    const c = firstComponent(m)
    const firstCase = c.cases[0]
    if (!firstCase) throw new Error('first component has no cases')

    await page.goto('/')
    await page.getByTestId(DcTestIds.modeSwitch('library')).click()
    await expect(page).toHaveURL(new RegExp(`/c/${c.id}/${firstCase.id}$`))

    // Back → the Primer ("/"). Forward → the library deep link again.
    await page.goBack()
    await expect(page).toHaveURL(/\/$/)
    await expect(
      page.getByTestId(DcTestIds.modeSwitch('primer')),
    ).toHaveAttribute('aria-selected', 'true')

    await page.goForward()
    await expect(page).toHaveURL(new RegExp(`/c/${c.id}/${firstCase.id}$`))
    await expect(
      page.getByTestId(DcTestIds.modeSwitch('library')),
    ).toHaveAttribute('aria-selected', 'true')
  })
})
