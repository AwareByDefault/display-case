import { expect, test } from '@playwright/test'
import { DcTestIds } from '../src/ui/test-ids'

/**
 * A substrate declaring a render axis Display Case knows nothing about must get
 * a working control for it and have its value carried in the case's address.
 *
 * The built-in DOM substrate declares only `theme` (already driven by the header
 * toggle) and `viewport` (a stage axis), so without this fixture the chrome's
 * generic per-axis control would be reachable only in principle.
 */
const PORT = Number(process.env.DISPLAY_CASE_SUBSTRATE_PORT ?? 3197)
const BASE = `http://localhost:${PORT}`

test('the manifest declares the substrate-supplied render axis', async ({
  request,
}) => {
  const m = await (await request.get(`${BASE}/manifest.json`)).json()
  const density = m.substrate.variants.find(
    (a: { id: string }) => a.id === 'density',
  )
  expect(density.kind).toBe('render')
  expect(density.default).toBe('comfortable')
})

test('the chrome renders a control for the declared axis', async ({ page }) => {
  await page.goto(BASE)
  await expect(page.getByTestId(DcTestIds.app)).toBeVisible()
  // Keyed by axis id — the chrome never learns what "density" means.
  await expect(
    page.getByTestId(DcTestIds.variantControl('density')),
  ).toBeVisible()
  // The theme axis has no separate control: the header toggle already drives it.
  await expect(page.getByTestId(DcTestIds.variantControl('theme'))).toHaveCount(
    0,
  )
})

test('the axis value is carried in the render address', async ({ page }) => {
  await page.goto(BASE)
  await expect(page.getByTestId(DcTestIds.app)).toBeVisible()
  const frame = page.getByTestId(DcTestIds.stageFrame)
  // The default is written into the address, not merely assumed.
  await expect(frame).toHaveAttribute('src', /density=comfortable/)
})

test('a declared axis value renders at its own address', async ({
  request,
}) => {
  // Every declared value is addressable — that is what makes a variant
  // snapshottable and deep-linkable.
  for (const value of ['comfortable', 'compact']) {
    const res = await request.get(
      `${BASE}/render/widget/default?density=${value}`,
    )
    expect(res.status(), `density=${value}`).toBe(200)
  }
})
