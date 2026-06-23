/**
 * Shared helpers for the Display Case e2e suite.
 *
 * The specs derive component/case ids from the live `/manifest.json` rather than
 * hardcoding them, so they survive renames and reordering of the showcased
 * components. The chrome lands on the Primer (when one is configured), so
 * `gotoLibrary` is the canonical way to reach the Cases view.
 */
import { type APIRequestContext, expect, type Page } from '@playwright/test'
import { DcTestIds } from '../src/ui/test-ids'

/** Minimal mirror of the server's manifest contract (see src/manifest.ts). */
export interface ManifestCase {
  id: string
  name: string
  browseUrl: string
  renderUrl: string
  tweaks: Record<string, unknown> | null
  transitions: string[]
}
export interface ManifestComponent {
  id: string
  name: string
  level: string | null
  isFlow: boolean
  group: string[]
  caseFile: string
  placardDoc: string | null
  cases: ManifestCase[]
}
export interface Manifest {
  title: string
  components: ManifestComponent[]
  /** Present browse modes, e.g. ['primer','components','exhibits']. */
  modes: ('primer' | 'components' | 'exhibits')[]
  landing: 'primer' | 'components' | 'exhibits'
}

export async function fetchManifest(
  request: APIRequestContext,
): Promise<Manifest> {
  const res = await request.get('/manifest.json')
  expect(res.ok(), `GET /manifest.json → ${res.status()}`).toBe(true)
  return (await res.json()) as Manifest
}

/** The first showcased component (the chrome's default landing exhibit). */
export function firstComponent(m: Manifest): ManifestComponent {
  const c = m.components[0]
  if (!c) throw new Error('manifest has no components')
  return c
}

/** A component that authored a `.placard.md`, so the Docs panel is available. */
export function componentWithDoc(m: Manifest): ManifestComponent | undefined {
  return m.components.find((c) => c.placardDoc && c.cases.length > 0)
}

/** A component with more than one case, for case-switching tests. */
export function componentWithCases(
  m: Manifest,
  min = 2,
): ManifestComponent | undefined {
  return m.components.find((c) => !c.isFlow && c.cases.length >= min)
}

/**
 * Open the chrome and ensure the Components (kit) view is showing. When another
 * mode is the landing (e.g. the Primer) the app opens there at `/`, so switch to
 * Components if its mode-switch tab is present.
 */
export async function gotoLibrary(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByTestId(DcTestIds.app)).toBeVisible()
  const components = page.getByTestId(DcTestIds.modeSwitch('components'))
  if ((await components.count()) > 0) await components.click()
}
