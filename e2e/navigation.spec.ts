import { expect, test } from '@playwright/test'
import { DcTestIds } from '../src/ui/test-ids'
import {
  componentWithCases,
  fetchManifest,
  firstComponent,
  gotoLibrary,
} from './helpers'

test.describe('library navigation', () => {
  test('selecting a component routes to its first case and exhibits it', async ({
    page,
    request,
  }) => {
    const m = await fetchManifest(request)
    const c = firstComponent(m)
    const firstCase = c.cases[0]
    if (!firstCase) throw new Error('component has no cases')

    await gotoLibrary(page)

    const componentNav = page.getByTestId(DcTestIds.navComponent(c.id))
    await expect(componentNav).toBeVisible()
    await componentNav.click()

    // The address reflects the selected component + its first case…
    await expect(page).toHaveURL(new RegExp(`/c/${c.id}/${firstCase.id}$`))
    // …the row is marked current…
    await expect(componentNav).toHaveAttribute('aria-current', 'true')
    // …and the case renders on the stage (the iframe mounts a component).
    const frame = page.getByTestId(DcTestIds.stageFrame)
    await expect(frame).toBeVisible()
    await expect(
      page
        .frameLocator(`[data-testid="${DcTestIds.stageFrame}"]`)
        .locator('#root'),
    ).not.toBeEmpty()
  })

  test('expanding a component and clicking a case switches the exhibit', async ({
    page,
    request,
  }) => {
    const m = await fetchManifest(request)
    const c = componentWithCases(m, 2)
    test.skip(!c, 'no multi-case component in this showcase')
    if (!c) return
    const target = c.cases[1]
    if (!target) throw new Error('expected a second case')

    await gotoLibrary(page)

    // Selecting the component expands its case list and lands on the first case.
    await page.getByTestId(DcTestIds.navComponent(c.id)).click()
    const caseNav = page.getByTestId(DcTestIds.navCase(c.id, target.id))
    await expect(caseNav).toBeVisible()

    await caseNav.click()
    await expect(page).toHaveURL(new RegExp(`/c/${c.id}/${target.id}$`))
    await expect(caseNav).toHaveAttribute('aria-current', 'true')
  })

  test('a deep link opens straight into the right exhibit', async ({
    page,
    request,
  }) => {
    const m = await fetchManifest(request)
    const c = firstComponent(m)
    const cs = c.cases[0]
    if (!cs) throw new Error('component has no cases')

    await page.goto(`/c/${c.id}/${cs.id}`)

    await expect(page.getByTestId(DcTestIds.app)).toBeVisible()
    // A deep link lands in the library (not the Primer) with the row current.
    await expect(
      page.getByTestId(DcTestIds.navComponent(c.id)),
    ).toHaveAttribute('aria-current', 'true')
    await expect(page.getByTestId(DcTestIds.stageFrame)).toBeVisible()
  })

  test('a deep link scrolls the active row into view when it sits below the fold', async ({
    page,
    request,
  }) => {
    const m = await fetchManifest(request)
    // The last component sits at the bottom of a rail far taller than the
    // viewport, so it starts below the fold. Deep-linking to it must scroll the
    // rail so its (current) row is on screen — not stranded out of view.
    const last = m.components.at(-1)
    test.skip(
      !last || m.components.length < 8 || (last?.cases.length ?? 0) === 0,
      'showcase too short to push a row below the fold',
    )
    if (!last) return
    const cs = last.cases[0]
    if (!cs) throw new Error('component has no cases')

    await page.goto(`/c/${last.id}/${cs.id}`)

    await expect(page.getByTestId(DcTestIds.app)).toBeVisible()
    const row = page.getByTestId(DcTestIds.navComponent(last.id))
    await expect(row).toHaveAttribute('aria-current', 'true')
    // The row is both marked current and actually visible in the viewport.
    await expect(row).toBeInViewport()
  })

  test('the disclosure chevron toggles a case list without navigating', async ({
    page,
    request,
  }) => {
    const m = await fetchManifest(request)
    // The first component is auto-expanded on load, so target a *different*
    // multi-case component that starts collapsed.
    const c = m.components.find(
      (x) => !x.isFlow && x.cases.length >= 2 && x.id !== m.components[0]?.id,
    )
    test.skip(!c, 'no collapsed multi-case component in this showcase')
    if (!c) return
    const secondCase = c.cases[1]
    if (!secondCase) throw new Error('expected a second case')

    await gotoLibrary(page)

    const toggle = page.getByTestId(DcTestIds.navComponentToggle(c.id))
    const caseNav = page.getByTestId(DcTestIds.navCase(c.id, secondCase.id))

    // Expanding via the chevron reveals the cases but leaves the address alone.
    await expect(caseNav).toBeHidden()
    await toggle.click()
    await expect(caseNav).toBeVisible()
    await expect(page).not.toHaveURL(new RegExp(`/c/${c.id}/`))
  })
})
