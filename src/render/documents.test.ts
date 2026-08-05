import { describe, expect, test } from 'bun:test'
import type { Manifest } from '../core/manifest'
import { type DocAssets, primerDoc, shellDoc } from './documents'

const importmap = {
  react: '/assets/vendor-react-xyz789.js',
  'react-dom': '/assets/vendor-react-dom-aaa111.js',
  'react-dom/client': '/assets/vendor-react-dom-client-bbb222.js',
  'react/jsx-runtime': '/assets/vendor-react-jsx-runtime-ccc333.js',
}

const assets: DocAssets = {
  browser: '/assets/browser-abc123.js',
  render: { button: '/assets/render-case-button-def456.js' },
  primer: '/assets/primer-ghi789.js',
  importmap,
}

const manifest: Manifest = {
  title: 'My Showcase',
  components: [],
  groups: [],
  modes: ['primer', 'components'],
  landing: 'primer',
  substrate: { id: 'dom', variants: [] },
}

describe('shellDoc', () => {
  const doc = () =>
    shellDoc({
      title: 'My Showcase',
      tokensCss: '.tok{}',
      globalCss: '.glob{}',
      vitrineCss: '.vit{}',
      theme: 'dark',
      signals: [],
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

  test('declares a user-agent color scheme matching the theme', () => {
    expect(doc()).toContain('color-scheme:dark')
    const light = shellDoc({
      title: 'X',
      tokensCss: '',
      globalCss: '',
      vitrineCss: '',
      theme: 'light',
      signals: [],
      markup: '',
      ssr: false,
      manifest,
      a11y: false,
      assets,
    })
    expect(light).toContain('color-scheme:light')
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
      signals: [],
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

describe('primerDoc', () => {
  const doc = () =>
    primerDoc({
      tokensCss: '.tok{}',
      globalCss: '.glob{}',
      vitrineCss: '.vit{}',
      theme: 'dark',
      signals: [],
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

  test('declares a user-agent color scheme matching the theme', () => {
    expect(doc()).toContain('color-scheme:dark')
  })

  test('style-engine output is a discrete tag after the static <style> block', () => {
    const tag = '<style data-emotion="css 9zz">.y{}</style>'
    const html = primerDoc({
      tokensCss: '.tok{}',
      globalCss: '.glob{}',
      vitrineCss: '.vit{}',
      theme: 'dark',
      signals: [],
      markup: '<article>primer</article>',
      ssr: true,
      headStyles: tag,
      assets,
    })
    expect(html).toContain(`</style>${tag}`)
  })

  test('emits the React importmap before the primer module script', () => {
    const html = doc()
    expect(html).toContain('<script type="importmap">')
    expect(html).toContain('"react":"/assets/vendor-react-xyz789.js"')
    expect(html.indexOf('importmap')).toBeLessThan(
      html.indexOf('type="module"'),
    )
  })
})
