import { describe, expect, test } from 'bun:test'
import type { Manifest } from '../core/manifest'
import { type DocAssets, primerDoc, renderDoc, shellDoc } from './documents'

const assets: DocAssets = {
  browser: '/assets/browser-abc123.js',
  render: '/assets/render-def456.js',
  primer: '/assets/primer-ghi789.js',
}

const manifest: Manifest = {
  title: 'My Showcase',
  components: [],
  primer: true,
  landing: 'primer',
}

describe('shellDoc', () => {
  const doc = () =>
    shellDoc({
      title: 'My Showcase',
      tokensCss: '.tok{}',
      globalCss: '.glob{}',
      vitrineCss: '.vit{}',
      theme: 'dark',
      markup: '<header>chrome</header>',
      ssr: true,
      manifest,
      a11y: false,
      assets,
    })

  test('is a themed HTML document carrying the title and pre-rendered markup', () => {
    const html = doc()
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('data-theme="dark"')
    expect(html).toContain('<title>My Showcase</title>')
    expect(html).toContain('<header>chrome</header>')
  })

  test('inlines all of the supplied CSS layers', () => {
    const html = doc()
    expect(html).toContain('.tok{}')
    expect(html).toContain('.glob{}')
    expect(html).toContain('.vit{}')
  })

  test('seeds the manifest, theme, and a11y flag for hydration', () => {
    const html = doc()
    expect(html).toContain('window.__dcSeed=')
    expect(html).toContain('"My Showcase"')
    expect(html).toContain('"theme":"dark"')
    expect(html).toContain('"a11y":false')
  })

  test('marks the root server-rendered and references the browser entry', () => {
    expect(doc()).toContain('data-ssr="1"')
    expect(doc()).toContain('src="/assets/browser-abc123.js"')
  })

  test('marks the root as client-only when ssr is false', () => {
    const html = shellDoc({
      title: 'X',
      tokensCss: '',
      globalCss: '',
      vitrineCss: '',
      theme: 'light',
      markup: '',
      ssr: false,
      manifest,
      a11y: false,
      assets,
    })
    expect(html).toContain('data-ssr="0"')
  })

  test('carries no dev live-reload machinery', () => {
    expect(doc()).not.toContain('__livereload')
    expect(doc().toLowerCase()).not.toContain('eventsource')
  })
})

describe('renderDoc', () => {
  const doc = (over: Partial<Parameters<typeof renderDoc>[0]> = {}) =>
    renderDoc({
      globalCss: '.g{}',
      vitrineCss: '.vit{}',
      theme: 'light',
      transparent: false,
      fit: false,
      markup: '<button>x</button>',
      ssr: true,
      assets,
      ...over,
    })

  test('renders the isolated case markup with both theme attributes', () => {
    const html = doc()
    expect(html).toContain('data-theme="light"')
    expect(html).toContain('data-theme-pref="light"')
    expect(html).toContain('<button>x</button>')
    expect(html).toContain('src="/assets/render-def456.js"')
  })

  test('inlines the global and Vitrine CSS so a dogfooded case is styled pre-script', () => {
    const html = doc()
    expect(html).toContain('.g{}')
    expect(html).toContain('.vit{}')
  })

  test('a transparent exhibit decorates the body and clears its background', () => {
    const html = doc({ transparent: true })
    expect(html).toContain('data-decorated')
    expect(html).toContain('background:transparent')
  })

  test('a fitted exhibit shrink-wraps the root to its content width', () => {
    expect(doc({ fit: true })).toContain('width:fit-content')
    expect(doc({ fit: false })).not.toContain('width:fit-content')
  })

  test('reflects the ssr flag on the root', () => {
    expect(doc({ ssr: true })).toContain('data-ssr="1"')
    expect(doc({ ssr: false })).toContain('data-ssr="0"')
  })

  test('omitting headStyles is byte-identical to passing empty (inert when unused)', () => {
    expect(doc({})).toBe(doc({ headStyles: '' }))
  })

  test('style-engine output is a discrete tag after the static <style> block', () => {
    const tag = '<style data-emotion="css 1ab2">.x{}</style>'
    const html = doc({ headStyles: tag })
    expect(html).toContain(tag)
    // Placed after the base block closes, before the head closes — not folded
    // into the static <style> (so emotion's data-emotion adoption markers survive).
    expect(html).toContain(`</style>${tag}</head>`)
  })
})

describe('primerDoc', () => {
  const doc = () =>
    primerDoc({
      tokensCss: '.tok{}',
      globalCss: '.glob{}',
      vitrineCss: '.vit{}',
      theme: 'dark',
      markup: '<article>primer</article>',
      ssr: true,
      assets,
    })

  test('is the themed primer reading page with its markup and entry', () => {
    const html = doc()
    expect(html).toContain('<title>Primer</title>')
    expect(html).toContain('data-theme="dark"')
    expect(html).toContain('data-theme-pref="dark"')
    expect(html).toContain('<article>primer</article>')
    expect(html).toContain('src="/assets/primer-ghi789.js"')
  })

  test('inlines the token, global, and Vitrine CSS and marks the ssr root', () => {
    const html = doc()
    expect(html).toContain('.tok{}')
    expect(html).toContain('.glob{}')
    expect(html).toContain('.vit{}')
    expect(html).toContain('data-ssr="1"')
  })

  test('style-engine output is a discrete tag after the static <style> block', () => {
    const tag = '<style data-emotion="css 9zz">.y{}</style>'
    const html = primerDoc({
      tokensCss: '.tok{}',
      globalCss: '.glob{}',
      vitrineCss: '.vit{}',
      theme: 'dark',
      markup: '<article>primer</article>',
      ssr: true,
      headStyles: tag,
      assets,
    })
    expect(html).toContain(`</style>${tag}</head>`)
  })
})
