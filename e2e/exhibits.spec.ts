import { expect, test } from '@playwright/test'
import { DcTestIds } from '../src/ui/test-ids'
import { fetchManifest } from './helpers'

test.describe('Components / Exhibits modes', () => {
  test('the mode switch offers every present mode', async ({
    page,
    request,
  }) => {
    const m = await fetchManifest(request)
    test.skip(m.modes.length < 2, 'a single-mode showcase shows no switch')
    await page.goto('/')
    await expect(page.getByTestId(DcTestIds.app)).toBeVisible()
    for (const mode of m.modes) {
      await expect(page.getByTestId(DcTestIds.modeSwitch(mode))).toBeVisible()
    }
  })

  test('switching to Exhibits lists surfaces and routes under /e/', async ({
    page,
    request,
  }) => {
    const m = await fetchManifest(request)
    test.skip(!m.modes.includes('exhibits'), 'no page/flow surfaces')
    const surface = m.components.find(
      (c) => c.level === 'page' || c.level === 'flow',
    )
    if (!surface) return

    await page.goto('/')
    await page.getByTestId(DcTestIds.modeSwitch('exhibits')).click()
    await expect(
      page.getByTestId(DcTestIds.modeSwitch('exhibits')),
    ).toHaveAttribute('aria-selected', 'true')
    // Landing on the first surface, addressed under the /e/ (Exhibits) prefix.
    await expect(page).toHaveURL(new RegExp(`/e/${surface.id}/`))
    await expect(
      page.getByTestId(DcTestIds.navComponent(surface.id)),
    ).toBeVisible()
  })

  test('the sidebar filter narrows the listing', async ({ page, request }) => {
    const m = await fetchManifest(request)
    test.skip(!m.modes.includes('components'), 'no building-block kit')
    const kit = m.components.filter(
      (c) => c.level !== 'page' && c.level !== 'flow',
    )
    const keep = kit[0]
    // A kit component whose name doesn't contain the kept one's (so the filter
    // text can't also match it) — gives a deterministic "dropped" row.
    const drop = kit.find(
      (c) =>
        c.id !== keep?.id &&
        !c.name.toLowerCase().includes(keep?.name.toLowerCase() ?? ''),
    )
    test.skip(!keep || !drop, 'need two distinctly-named kit components')
    if (!keep || !drop) return

    await page.goto('/')
    await page.getByTestId(DcTestIds.modeSwitch('components')).click()
    await page.getByTestId(DcTestIds.navFilter).fill(keep.name)
    await expect(
      page.getByTestId(DcTestIds.navComponent(keep.id)),
    ).toBeVisible()
    await expect(page.getByTestId(DcTestIds.navComponent(drop.id))).toHaveCount(
      0,
    )
    // Clearing restores the dropped row.
    await page.getByTestId(DcTestIds.navFilter).fill('')
    await expect(
      page.getByTestId(DcTestIds.navComponent(drop.id)),
    ).toBeVisible()
  })

  test('a grouped surface shows its group-path breadcrumb', async ({
    page,
    request,
  }) => {
    const m = await fetchManifest(request)
    const surface = m.components.find(
      (c) => (c.level === 'page' || c.level === 'flow') && c.group.length > 0,
    )
    test.skip(!surface, 'no grouped surface in this showcase')
    if (!surface) return
    const firstCase = surface.cases[0]
    if (!firstCase) throw new Error('surface has no cases')

    await page.goto(`/e/${surface.id}/${firstCase.id}`)
    const crumb = page.getByTestId(DcTestIds.breadcrumb)
    await expect(crumb).toBeVisible()
    await expect(crumb).toContainText(surface.group[surface.group.length - 1])
  })

  test('flows carry a marker that pages do not', async ({ page, request }) => {
    const m = await fetchManifest(request)
    const flow = m.components.find((c) => c.isFlow)
    const pageSurface = m.components.find(
      (c) => c.level === 'page' && !c.isFlow,
    )
    test.skip(!flow || !pageSurface, 'need both a flow and a page surface')
    if (!flow || !pageSurface) return

    await page.goto(`/e/${flow.id}/${flow.cases[0].id}`)
    // This showcase marks flows with the `flow` tag pill; a page row has neither
    // a tag nor a glyph.
    const m2 = await fetchManifest(request)
    const markerClass =
      m2.flowMarker === 'tag' ? '.dcui-nav-tag' : '.dcui-nav-icon'
    await expect(
      page.locator(
        `[data-testid="${DcTestIds.navComponent(flow.id)}"] ${markerClass}`,
      ),
    ).toHaveCount(1)
    await expect(
      page.locator(
        `[data-testid="${DcTestIds.navComponent(pageSurface.id)}"] .dcui-nav-tag, [data-testid="${DcTestIds.navComponent(pageSurface.id)}"] .dcui-nav-icon`,
      ),
    ).toHaveCount(0)
    // The active flow's step rows are numbered.
    await expect(
      page.locator(
        `[data-testid="${DcTestIds.navCase(flow.id, flow.cases[0].id)}"] .dcui-nav-index`,
      ),
    ).toHaveText('1')
  })
})
