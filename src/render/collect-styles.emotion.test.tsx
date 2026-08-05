/** @jsxImportSource @emotion/react */

import { describe, expect, test } from 'bun:test'
import createCache from '@emotion/cache'
import { CacheProvider, css } from '@emotion/react'
import createEmotionServer from '@emotion/server/create-instance'
import { type DisplayCaseConfig, defineCases, type StyleEngine } from '../index'
import { type DomFrame, domSubstrate } from '../substrate/dom'
import type { CaseTreeState } from './render-node'
import { makeCaseRenderer } from './ssr-render'

/**
 * Real-library validation of the style-engine seam: the flagship emotion engine
 * from `docs/style-engines.md`, verbatim, exercised through the actual case
 * renderer and the production render document. This closes the server half of
 * the spike (tasks 1.4 / 6.5) with `@emotion/react` + `@emotion/server` rather
 * than a stub — proving render-time emotion styling is extracted and delivered
 * in the document head before scripting. (Client adoption of the `data-emotion`
 * tags is emotion's own runtime behavior, verified in a consuming repo.)
 */

// ── The flagship recipe, copied from docs/style-engines.md ──────────────────
const emotionEngine: StyleEngine = () => {
  const cache = createCache({ key: 'css' })
  cache.compat = true
  const { extractCriticalToChunks, constructStyleTagsFromChunks } =
    createEmotionServer(cache)
  return {
    wrap: (node) => <CacheProvider value={cache}>{node}</CacheProvider>,
    collect: (html) =>
      constructStyleTagsFromChunks(extractCriticalToChunks(html)),
  }
}

const config: DisplayCaseConfig = {
  title: 'T',
  roots: [],
  styleEngines: [emotionEngine],
}

const state = (over: Partial<CaseTreeState>): CaseTreeState => ({
  componentId: 'box',
  caseId: 'default',
  width: null,
  tweaks: {},
  ...over,
})

// A component styled by emotion at render time (the `css` prop).
const Hot = () => <div css={css({ color: 'rgb(12, 34, 56)' })}>hot</div>
const Cool = () => <div css={css({ color: 'rgb(98, 76, 54)' })}>cool</div>

/** Render one case through the DOM substrate and read its frame back. */
async function renderFrame(
  modules: Parameters<typeof makeCaseRenderer>[0],
  s: CaseTreeState,
): Promise<DomFrame> {
  const render = makeCaseRenderer(modules, config, domSubstrate())
  return (await render(s)).frame as DomFrame
}

describe('emotion style engine (real library)', () => {
  test('extracts render-time emotion CSS into headStyles', async () => {
    const frame = await renderFrame(
      [defineCases('Box', { Default: () => <Hot /> })],
      state({}),
    )

    // The markup carries an emotion-generated class…
    expect(frame.html).toContain('hot')
    expect(frame.html).toContain('css-')
    // …and the head styling carries real <style data-emotion> tags with the rule.
    expect(frame.headStyles).toContain('data-emotion')
    expect(frame.headStyles).toContain('rgb(12, 34, 56)')
  })

  test('the extracted tags sit as a discrete block after the static <style>', async () => {
    const frame = await renderFrame(
      [defineCases('Box', { Default: () => <Hot /> })],
      state({}),
    )
    const html = domSubstrate().document(frame, {
      componentId: 'box',
      caseId: 'default',
      tweaks: {},
      variants: { theme: 'light' },
      params: {},
      config: { ...config, theme: { signals: [] } },
      scriptSrc: '/r.js',
      importmap: {}, // not under test here; empty omits the importmap
      prerendered: true,
      hostScripts: '',
      resources: { globalCss: '.g{}', vitrineCss: '.v{}' },
    })
    // The real data-emotion tags land between the static block's close and </head>
    // — verbatim, not folded into the base <style> (so client adoption works).
    expect(html).toContain(`</style>${frame.headStyles}</head>`)
    expect(html).toContain('data-emotion')
  })

  test('each render is isolated — one case never carries another’s emotion CSS', async () => {
    const modules = [
      defineCases('Box', { Default: () => <Hot /> }),
      defineCases('Chip', { Default: () => <Cool /> }),
    ]
    const hot = await renderFrame(modules, state({ componentId: 'box' }))
    const cool = await renderFrame(modules, state({ componentId: 'chip' }))

    expect(hot.headStyles).toContain('rgb(12, 34, 56)')
    expect(hot.headStyles).not.toContain('rgb(98, 76, 54)')
    expect(cool.headStyles).toContain('rgb(98, 76, 54)')
    expect(cool.headStyles).not.toContain('rgb(12, 34, 56)')
  })
})
