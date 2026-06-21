import { AxeBuilder } from '@axe-core/playwright'
import { chromium } from 'playwright'
import type {
  A11yImpact,
  A11yNodeDetail,
  AuditOptions,
  CaseContext,
  RenderDriver,
  RenderedPage,
} from '../index'

/** The first numeric run in axe's `expectedContrastRatio` (e.g. `"4.5:1"` → 4.5). */
function parseRatio(value: unknown): number {
  const m = /[\d.]+/.exec(String(value ?? ''))
  return m ? Number(m[0]) : 0
}

/** Flatten one axe node into our serializable detail: the element + (for
 *  colour-contrast) the measured pair, so the cache/CLI carry actionable data. */
function nodeDetail(node: {
  target?: unknown[]
  html?: string
  failureSummary?: string
  any?: { id: string; data?: unknown }[]
  all?: { id: string; data?: unknown }[]
  none?: { id: string; data?: unknown }[]
}): A11yNodeDetail {
  const detail: A11yNodeDetail = {
    target: (node.target ?? []).map((t) => String(t)).join(' '),
    html: (node.html ?? '').slice(0, 200),
  }
  if (node.failureSummary) detail.failureSummary = node.failureSummary
  const cc = [
    ...(node.any ?? []),
    ...(node.all ?? []),
    ...(node.none ?? []),
  ].find((c) => c.id === 'color-contrast')
  const d = cc?.data as Record<string, unknown> | undefined
  if (d && (d.fgColor || d.bgColor)) {
    detail.contrast = {
      foreground: String(d.fgColor),
      background: String(d.bgColor),
      ratio: Number(d.contrastRatio),
      required: parseRatio(d.expectedContrastRatio),
    }
    if (d.fontSize) detail.contrast.fontSize = String(d.fontSize)
    if (d.fontWeight) detail.contrast.fontWeight = String(d.fontWeight)
  }
  return detail
}

/**
 * Built-in render driver: Playwright Chromium + axe-core. Imported lazily by the
 * check runner only when no custom driver is configured, so `playwright` and
 * `@axe-core/playwright` stay optional dependencies.
 *
 * Reproduces the previous runner behavior: a fixed 1024×768 viewport, reduced
 * motion, a wait for the network to settle and fonts to load, and a WCAG 2 A/AA
 * audit (page-structure best-practice rules are out of scope for fragments).
 */

const VIEWPORT = { width: 1024, height: 768 }
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

export async function createPlaywrightDriver(): Promise<RenderDriver> {
  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: VIEWPORT,
    reducedMotion: 'reduce',
  })

  return {
    async open(url: string, _ctx: CaseContext): Promise<RenderedPage> {
      const page = await context.newPage()
      await page.goto(url, { waitUntil: 'networkidle' })
      await page.evaluate(() => document.fonts.ready)
      return {
        async screenshot() {
          return page.screenshot()
        },
        async audit(opts?: AuditOptions) {
          let builder = new AxeBuilder({ page }).withTags(WCAG_TAGS)
          if (opts?.exclude?.length)
            builder = builder.disableRules(opts.exclude)
          const { violations } = await builder.analyze()
          return violations.map((v) => ({
            id: v.id,
            help: v.help,
            nodes: v.nodes.length,
            // axe's impact is a string union or null/undefined; normalize.
            impact: (v.impact ?? null) as A11yImpact | null,
            details: v.nodes.map(nodeDetail),
          }))
        },
        async dispose() {
          await page.close()
        },
      }
    },
    async close() {
      await browser.close()
    },
  }
}
