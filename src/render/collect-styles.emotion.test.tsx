/** @jsxImportSource @emotion/react */

import { describe, expect, test } from 'bun:test'
import createCache from '@emotion/cache'
import { CacheProvider, css } from '@emotion/react'
import createEmotionServer from '@emotion/server/create-instance'
import { type DisplayCaseConfig, defineCases, type StyleEngine } from '../index'
import { renderDoc } from './documents'
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

describe('emotion style engine (real library)', () => {
  test('extracts render-time emotion CSS into headStyles', () => {
    const render = makeCaseRenderer(
      [defineCases('Box', { Default: () => <Hot /> })],
      config,
    )
    const result = render(state({}))

    // The markup carries an emotion-generated class…
    expect(result.html).toContain('hot')
    expect(result.html).toContain('css-')
    // …and the head styling carries real <style data-emotion> tags with the rule.
    expect(result.headStyles).toContain('data-emotion')
    expect(result.headStyles).toContain('rgb(12, 34, 56)')
  })

  test('the extracted tags sit as a discrete block after the static <style>', () => {
    const render = makeCaseRenderer(
      [defineCases('Box', { Default: () => <Hot /> })],
      config,
    )
    const result = render(state({}))
    const html = renderDoc({
      globalCss: '.g{}',
      vitrineCss: '.v{}',
      theme: 'light',
      transparent: false,
      fit: false,
      markup: result.html,
      ssr: true,
      headStyles: result.headStyles,
      scriptSrc: '/r.js',
      importmap: {}, // not under test here; empty omits the importmap
    })
    // The real data-emotion tags land between the static block's close and </head>
    // — verbatim, not folded into the base <style> (so client adoption works).
    expect(html).toContain(`</style>${result.headStyles}</head>`)
    expect(html).toContain('data-emotion')
  })

  test('each render is isolated — one case never carries another’s emotion CSS', () => {
    const render = makeCaseRenderer(
      [
        defineCases('Box', { Default: () => <Hot /> }),
        defineCases('Chip', { Default: () => <Cool /> }),
      ],
      config,
    )
    const hot = render(state({ componentId: 'box' }))
    const cool = render(state({ componentId: 'chip' }))

    expect(hot.headStyles).toContain('rgb(12, 34, 56)')
    expect(hot.headStyles).not.toContain('rgb(98, 76, 54)')
    expect(cool.headStyles).toContain('rgb(98, 76, 54)')
    expect(cool.headStyles).not.toContain('rgb(12, 34, 56)')
  })
})
