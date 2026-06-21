import { expect, test } from '@playwright/test'
import { DcTestIds } from '../src/ui/test-ids'
import { fetchManifest, firstComponent } from './helpers'

// The machine-readable contract an AI agent (or snapshot tool) relies on:
// /health, /manifest.json, and the isolated /render endpoint.
test.describe('Display Case server contract', () => {
  test('GET /health returns ok', async ({ request }) => {
    const res = await request.get('/health')
    expect(res.ok()).toBe(true)
    expect((await res.text()).trim()).toBe('ok')
  })

  test('GET /manifest.json enumerates components and cases', async ({
    request,
  }) => {
    const m = await fetchManifest(request)
    expect(typeof m.title).toBe('string')
    expect(m.title.length).toBeGreaterThan(0)
    expect(Array.isArray(m.components)).toBe(true)
    expect(m.components.length).toBeGreaterThan(0)

    for (const c of m.components) {
      expect(c.id, 'component has an id').toBeTruthy()
      expect(c.name, 'component has a name').toBeTruthy()
      expect(c.cases.length, `${c.id} has at least one case`).toBeGreaterThan(0)
      for (const cs of c.cases) {
        expect(cs.id, `${c.id} case has an id`).toBeTruthy()
        // Render URL is the deterministic snapshot address.
        expect(cs.renderUrl).toBe(`/render/${c.id}/${cs.id}`)
        expect(cs.browseUrl).toBe(`/c/${c.id}/${cs.id}`)
      }
    }
  })

  test('the isolated /render endpoint serves a chrome-free document', async ({
    page,
    request,
  }) => {
    const m = await fetchManifest(request)
    const c = firstComponent(m)
    const cs = c.cases[0]
    if (!cs) throw new Error('first component has no cases')

    await page.goto(`${cs.renderUrl}?theme=dark`)

    // The render doc mounts exactly one case into #root and carries no browse
    // chrome (no sidebar, no header app shell).
    await expect(page.locator('#root')).not.toBeEmpty()
    await expect(page.getByTestId(DcTestIds.app)).toHaveCount(0)

    // Theme is applied from the URL so a snapshot renders in the right scope.
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  })
})
