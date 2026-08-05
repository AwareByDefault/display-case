import { describe, expect, test } from 'bun:test'
import type { Substrate, SubstrateDocumentContext } from '../core/substrate'
import type { DisplayCaseConfig } from '../index'
import { type DomFrame, domSubstrate } from './dom'
import { renderVariants, resolveSubstrate } from './resolve'

/**
 * The DOM substrate's document is the one the dev server, the published build,
 * and every snapshot are cut from, so these assertions are the contract that
 * extracting it behind the substrate seam changed nothing.
 */

const importmap = {
  react: '/assets/vendor-react-xyz789.js',
  'react-dom/client': '/assets/vendor-react-dom-client-bbb222.js',
}

const NO_CONFIG = {} as DisplayCaseConfig

const frame = (over: Partial<DomFrame> = {}): DomFrame => ({
  html: '<button>x</button>',
  browserOnly: false,
  headStyles: '',
  ...over,
})

const ctx = (
  over: Partial<SubstrateDocumentContext> = {},
): SubstrateDocumentContext => ({
  componentId: 'button',
  caseId: 'default',
  tweaks: {},
  variants: { theme: 'light' },
  params: {},
  config: { ...NO_CONFIG, theme: { signals: [] } },
  scriptSrc: '/assets/render-case-button-def456.js',
  importmap,
  prerendered: true,
  hostScripts: '',
  resources: { globalCss: '.g{}', vitrineCss: '.vit{}' },
  ...over,
})

const doc = (
  overCtx: Partial<SubstrateDocumentContext> = {},
  overFrame: Partial<DomFrame> = {},
) => domSubstrate().document(frame(overFrame), ctx(overCtx))

describe('domSubstrate document', () => {
  test('renders the isolated case markup with both theme attributes', () => {
    const html = doc()
    expect(html).toContain('data-theme="light"')
    expect(html).toContain('data-theme-pref="light"')
    expect(html).toContain('<button>x</button>')
    expect(html).toContain('src="/assets/render-case-button-def456.js"')
  })

  test('inlines the global and Vitrine CSS so a dogfooded case is styled pre-script', () => {
    const html = doc()
    expect(html).toContain('.g{}')
    expect(html).toContain('.vit{}')
  })

  test('declares a user-agent color scheme matching the theme', () => {
    expect(doc({ variants: { theme: 'light' } })).toContain(
      'color-scheme:light',
    )
    expect(doc({ variants: { theme: 'dark' } })).toContain('color-scheme:dark')
  })

  test('a transparent exhibit decorates the body and clears its background', () => {
    const html = doc({ params: { transparent: '1' } })
    expect(html).toContain('data-decorated')
    expect(html).toContain('background:transparent')
  })

  test('a fitted exhibit shrink-wraps the root to its content width', () => {
    expect(doc({ params: { fit: '1' } })).toContain('width:fit-content')
    expect(doc({ params: {} })).not.toContain('width:fit-content')
  })

  test('reflects whether the frame was pre-rendered on the root', () => {
    expect(doc({ prerendered: true })).toContain('data-ssr="1"')
    expect(doc({ prerendered: false })).toContain('data-ssr="0"')
  })

  test('empty headStyles leaves the document in its engine-free form', () => {
    expect(doc({}, { headStyles: '' })).toBe(doc({}, {}))
  })

  test('style-engine output is a discrete tag after the static <style> block', () => {
    const tag = '<style data-emotion="css 1ab2">.x{}</style>'
    const html = doc({}, { headStyles: tag })
    expect(html).toContain(tag)
    // Placed right after the base block closes — not folded into the static
    // <style> (so emotion's data-emotion adoption markers survive). The
    // importmap follows it before the head closes.
    expect(html).toContain(`</style>${tag}`)
  })

  test('emits an importmap resolving each shared specifier to its vendor bundle', () => {
    const html = doc()
    expect(html).toContain('<script type="importmap">')
    expect(html).toContain('"react":"/assets/vendor-react-xyz789.js"')
    expect(html).toContain(
      '"react-dom/client":"/assets/vendor-react-dom-client-bbb222.js"',
    )
    // Before the module script that imports those bare specifiers.
    expect(html.indexOf('importmap')).toBeLessThan(
      html.indexOf('type="module"'),
    )
  })

  test('omits the importmap when nothing is shared', () => {
    expect(doc({ importmap: {} })).not.toContain('importmap')
  })

  test('places host scripts after the theme seed and before the module script', () => {
    // This is what makes the dev document and the published one the same
    // template: dev passes its error-overlay/live-reload injects here, the
    // published build passes none.
    const html = doc({ hostScripts: '<script>/*dev*/</script>' })
    expect(html).toContain('<script>/*dev*/</script>')
    expect(html.indexOf('/*dev*/')).toBeLessThan(html.indexOf('type="module"'))
  })

  test('a substrate with no stage script emits no module script tag', () => {
    // A static-frame substrate is a complete substrate; the document must not
    // assume a client runtime exists.
    expect(doc({ scriptSrc: undefined })).not.toContain('type="module"')
  })
})

describe('domSubstrate document is byte-for-byte what it always was', () => {
  // Extracting the renderer behind the substrate seam had to change nothing a
  // client can observe. This pins the exact bytes of a rendered document — the
  // same string the pre-substrate template produced for the same inputs — so a
  // drift in spacing, attribute order, or script placement fails loudly instead
  // of silently invalidating every recorded baseline and hydration match.
  const golden =
    '<!doctype html><html lang="en" data-theme="dark" data-theme-pref="dark" class="dark">' +
    '<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>' +
    '<title>Display Case render</title><style>html,body{margin:0}html{color-scheme:dark}' +
    'body{background:var(--color-bg);color:var(--color-fg);font-family:var(--font-sans, ui-sans-serif, system-ui, sans-serif)}' +
    'body[data-decorated] #root>*{justify-content:center;align-content:center}.g{}\n.v{}</style></head>' +
    '<body><main id="root" style="width:fit-content" data-ssr="1"><button>x</button></main>' +
    '<script>window.__dcThemeSignals=["class"]</script>' +
    '<script type="module" src="/dist/render-case-button.js"></script></body></html>'

  test('matches the pre-substrate document exactly', () => {
    const html = domSubstrate().document(frame(), {
      componentId: 'button',
      caseId: 'default',
      tweaks: {},
      variants: { theme: 'dark' },
      params: { fit: '1' },
      // No theme config ⇒ the default `class` signal, as before.
      config: NO_CONFIG,
      scriptSrc: '/dist/render-case-button.js',
      importmap: {},
      prerendered: true,
      hostScripts: '',
      resources: { globalCss: '.g{}', vitrineCss: '.v{}' },
    })
    expect(html).toBe(golden)
  })

  test('the dev document differs from the published one only by its injects', () => {
    // The two templates that used to be maintained separately are now one call
    // with two arguments; this is the whole of their difference.
    const base = {
      componentId: 'button',
      caseId: 'default',
      tweaks: {},
      variants: { theme: 'dark' },
      params: { fit: '1' },
      config: NO_CONFIG,
      scriptSrc: '/dist/render-case-button.js',
      prerendered: true,
      resources: { globalCss: '.g{}', vitrineCss: '.v{}' },
    }
    const dev = domSubstrate().document(frame(), {
      ...base,
      importmap: {},
      hostScripts: '<!--dev-->',
    })
    const published = domSubstrate().document(frame(), {
      ...base,
      importmap: {},
      hostScripts: '',
    })
    expect(dev.replace('<!--dev-->', '')).toBe(published)
    expect(published).toBe(golden)
  })
})

describe('domSubstrate render', () => {
  const render = (clientOnly: boolean) =>
    domSubstrate().render(null, {
      componentId: 'button',
      caseId: 'default',
      tweaks: {},
      variants: { theme: 'light' },
      params: {},
      clientOnly,
      config: NO_CONFIG,
    })

  test('a client-only case yields an empty frame without attempting the render', () => {
    expect(render(true)).toEqual({
      html: '',
      browserOnly: true,
      headStyles: '',
    })
  })

  test('serializes a frame to its markup as html', () => {
    const s = domSubstrate().serialize(frame({ html: '<b>hi</b>' }))
    expect(new TextDecoder().decode(s.bytes)).toBe('<b>hi</b>')
    expect(s.ext).toBe('html')
  })
})

describe('domSubstrate declaration', () => {
  test('declares theme as a render axis and viewport as a stage axis', () => {
    const s = domSubstrate()
    const theme = s.variants.find((a) => a.id === 'theme')
    const viewport = s.variants.find((a) => a.id === 'viewport')
    expect(theme?.kind).toBe('render')
    expect(theme?.default).toBe('light')
    expect(theme?.values.map((v) => v.value)).toEqual(['light', 'dark'])
    // The viewport constrains the embedded stage, not the document inside it,
    // so switching it needs no re-render.
    expect(viewport?.kind).toBe('stage')
    expect(viewport?.default).toBe('full')
  })

  test('declares the React runtime as always shared', () => {
    // Substrate-declared rather than hard-coded in the bundler, so a substrate
    // whose stage is not React-based is not forced to carry it.
    expect(domSubstrate().alwaysShare).toContain('react')
  })
})

describe('domSubstrate check phases', () => {
  test('supplies token conformance for its own style vocabulary', () => {
    // CSS custom properties are the DOM medium's vocabulary; a substrate for
    // another medium supplies its own, or none.
    expect(typeof domSubstrate().checks?.tokens).toBe('function')
  })

  test('a substrate may supply none, marking the phase inapplicable', () => {
    const bare: Substrate = { ...domSubstrate(), id: 'bare', checks: undefined }
    expect(bare.checks?.tokens).toBeUndefined()
  })
})

describe('renderVariants', () => {
  const decode = (query: string, substrate = domSubstrate()) =>
    renderVariants(new URLSearchParams(query), substrate)

  test('reads a declared render axis from the address', () => {
    expect(decode('theme=dark')).toEqual({ theme: 'dark' })
  })

  test('falls back to the axis default when the address names none', () => {
    expect(decode('')).toEqual({ theme: 'light' })
  })

  test('an undeclared value falls back rather than rendering it', () => {
    // A hand-edited address must never select a variant the substrate does not
    // declare — otherwise it names a rendering that has no baseline and no
    // control in the chrome.
    expect(decode('theme=chartreuse')).toEqual({ theme: 'light' })
  })

  test('ignores stage axes, which change presentation and not the render', () => {
    // `viewport` constrains the embedded stage; it must not reach the renderer
    // or key a baseline.
    expect(decode('viewport=mobile')).toEqual({ theme: 'light' })
  })

  test("honors another substrate's axes without knowing their names", () => {
    const terminal = {
      ...domSubstrate(),
      id: 'terminal',
      variants: [
        {
          id: 'size',
          label: 'Size',
          kind: 'render' as const,
          values: [
            { value: '80x24', label: '80×24' },
            { value: '120x40', label: '120×40' },
          ],
          default: '80x24',
        },
        {
          id: 'color',
          label: 'Color',
          kind: 'render' as const,
          values: [
            { value: 'truecolor', label: 'True color' },
            { value: 'none', label: 'NO_COLOR' },
          ],
          default: 'truecolor',
        },
      ],
    }
    expect(decode('size=120x40&color=none', terminal)).toEqual({
      size: '120x40',
      color: 'none',
    })
    expect(decode('', terminal)).toEqual({
      size: '80x24',
      color: 'truecolor',
    })
  })
})

describe('resolveSubstrate', () => {
  test('defaults to the DOM substrate when the showcase configures none', () => {
    expect(resolveSubstrate(NO_CONFIG).id).toBe('dom')
  })

  test('returns the configured substrate as-is', () => {
    const custom = { ...domSubstrate(), id: 'custom' }
    expect(resolveSubstrate({ ...NO_CONFIG, substrate: custom }).id).toBe(
      'custom',
    )
  })

  test('routes the deprecated providers.driver into the DOM substrate', () => {
    // It is public API, so it keeps working rather than vanishing.
    const driver = () => ({}) as never
    const resolved = resolveSubstrate({ ...NO_CONFIG, providers: { driver } })
    expect((resolved as { driver?: unknown }).driver).toBe(driver)
  })
})
