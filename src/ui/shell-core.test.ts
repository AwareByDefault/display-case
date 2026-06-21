import { afterEach, describe, expect, test } from 'bun:test'
import type { Manifest, ManifestComponent } from '../core/manifest'
import {
  buildAddressUrl,
  buildRenderSrc,
  buildUrl,
  gridPad,
  groupByLevel,
  groupPrimerSections,
  initialSelectionFor,
  MAX_PAD,
  MIN_PAD,
  type PrimerSection,
  parseRoute,
  primerForLocation,
  resolveMode,
  type Selection,
  selSignature,
} from './shell-core'

// `primerForLocation` reads `window.location.pathname`; stub a minimal window
// for the duration of each case and restore it afterwards.
const realWindow = (globalThis as { window?: unknown }).window
afterEach(() => {
  ;(globalThis as { window?: unknown }).window = realWindow
})
function atPath(pathname: string): void {
  ;(globalThis as { window?: unknown }).window = { location: { pathname } }
}

function manifest(over: Partial<Manifest>): Manifest {
  return {
    title: 'T',
    components: [],
    primer: true,
    landing: 'primer',
    ...over,
  }
}

describe('primerForLocation', () => {
  test('the /primer route is the Primer whenever one is configured', () => {
    atPath('/primer')
    // Even when the landing default was overridden to the library, an explicit
    // /primer link still resolves to the Primer.
    expect(primerForLocation(manifest({ landing: 'library' }))).toBe(true)
  })

  test('the /primer route is the library when no Primer is configured', () => {
    atPath('/primer')
    expect(
      primerForLocation(manifest({ primer: false, landing: 'library' })),
    ).toBe(false)
  })

  test('the bare / landing honors the resolved landing', () => {
    atPath('/')
    expect(primerForLocation(manifest({ landing: 'primer' }))).toBe(true)
    expect(primerForLocation(manifest({ landing: 'library' }))).toBe(false)
  })

  test('a /c/... deep link is always a library address', () => {
    atPath('/c/button/default')
    expect(primerForLocation(manifest({ landing: 'primer' }))).toBe(false)
  })
})

function comp(over: Partial<ManifestComponent>): ManifestComponent {
  return {
    id: 'button',
    name: 'Button',
    level: 'atom',
    isFlow: false,
    caseFile: 'src/Button.case.tsx',
    placardDoc: null,
    cases: [],
    ...over,
  }
}

describe('parseRoute', () => {
  test('extracts the component and case ids from a /c/ path', () => {
    const r = parseRoute('/c/button/default', '')
    expect(r.componentId).toBe('button')
    expect(r.caseId).toBe('default')
    expect(r.path).toBe('/c/button/default')
  })

  test('collects only t.* query params into tweaks, stripping the prefix', () => {
    const r = parseRoute('/c/button/default', '?t.size=lg&t.disabled=1&other=x')
    expect(r.tweaks).toEqual({ size: 'lg', disabled: '1' })
  })

  test('reads docs=1 as the open docs flag', () => {
    expect(parseRoute('/c/x/y', '?docs=1').docs).toBe(true)
    expect(parseRoute('/c/x/y', '').docs).toBe(false)
  })

  test('yields empty ids for a path with no component segment', () => {
    const r = parseRoute('/', '')
    expect(r.componentId).toBe('')
    expect(r.caseId).toBe('')
  })
})

describe('resolveMode', () => {
  const route = (path: string) => parseRoute(path, '')

  test('/primer resolves to the primer only when one is configured', () => {
    expect(resolveMode(route('/primer'), manifest({ primer: true }))).toBe(
      'primer',
    )
    expect(resolveMode(route('/primer'), manifest({ primer: false }))).toBe(
      'library',
    )
  })

  test('the bare / landing honors the resolved landing', () => {
    expect(resolveMode(route('/'), manifest({ landing: 'primer' }))).toBe(
      'primer',
    )
    expect(resolveMode(route('/'), manifest({ landing: 'library' }))).toBe(
      'library',
    )
  })

  test('any deep link is a library address', () => {
    expect(
      resolveMode(route('/c/button/default'), manifest({ landing: 'primer' })),
    ).toBe('library')
  })
})

describe('initialSelectionFor', () => {
  test('uses the route selection when it names a component', () => {
    const route = parseRoute('/c/button/primary', '?t.size=lg')
    expect(initialSelectionFor(manifest({}), route)).toEqual({
      componentId: 'button',
      caseId: 'primary',
      tweaks: { size: 'lg' },
    })
  })

  test('falls back to the first component and its first case', () => {
    const route = parseRoute('/', '')
    const m = manifest({
      components: [
        comp({
          id: 'card',
          cases: [
            {
              id: 'a',
              name: 'A',
              browseUrl: '',
              renderUrl: '',
              tweaks: null,
              transitions: [],
            },
            {
              id: 'b',
              name: 'B',
              browseUrl: '',
              renderUrl: '',
              tweaks: null,
              transitions: [],
            },
          ],
        }),
      ],
    })
    expect(initialSelectionFor(m, route)).toEqual({
      componentId: 'card',
      caseId: 'a',
      tweaks: {},
    })
  })

  test('returns an empty selection when the manifest has no components', () => {
    expect(
      initialSelectionFor(manifest({ components: [] }), parseRoute('/', '')),
    ).toEqual({ componentId: '', caseId: '', tweaks: {} })
  })
})

describe('selSignature', () => {
  const sel = (over: Partial<Selection>): Selection => ({
    componentId: 'button',
    caseId: 'default',
    tweaks: {},
    ...over,
  })

  test('is stable for equal selections', () => {
    expect(selSignature(sel({}))).toBe(selSignature(sel({})))
  })

  test('changes when the case or a tweak changes', () => {
    const base = selSignature(sel({}))
    expect(selSignature(sel({ caseId: 'primary' }))).not.toBe(base)
    expect(selSignature(sel({ tweaks: { size: 'lg' } }))).not.toBe(base)
  })
})

describe('buildUrl', () => {
  test('builds a bare /c/ path when there are no tweaks or docs', () => {
    expect(buildUrl('button', 'default', {}, false)).toBe('/c/button/default')
  })

  test('encodes tweaks under the t. prefix and the docs flag', () => {
    expect(buildUrl('button', 'default', { size: 'lg' }, true)).toBe(
      '/c/button/default?t.size=lg&docs=1',
    )
  })

  test('round-trips through parseRoute', () => {
    const url = buildUrl('button', 'primary', { size: 'lg', on: '1' }, true)
    const [path, search] = url.split('?')
    const r = parseRoute(path, `?${search}`)
    expect(r.componentId).toBe('button')
    expect(r.caseId).toBe('primary')
    expect(r.tweaks).toEqual({ size: 'lg', on: '1' })
    expect(r.docs).toBe(true)
  })
})

describe('buildRenderSrc', () => {
  test('always sets the theme and appends tweaks', () => {
    const src = buildRenderSrc(
      '/render/button/default',
      'dark',
      { size: 'lg' },
      false,
      false,
    )
    expect(src.startsWith('/render/button/default?')).toBe(true)
    expect(src).toContain('theme=dark')
    expect(src).toContain('t.size=lg')
    expect(src).not.toContain('fit=1')
    expect(src).not.toContain('transparent=1')
  })

  test('adds the fit and transparent stage hints when requested', () => {
    const src = buildRenderSrc('/render/x/y', 'light', {}, true, true)
    expect(src).toContain('fit=1')
    expect(src).toContain('transparent=1')
  })
})

describe('buildAddressUrl', () => {
  test('prefixes the origin and carries theme + tweaks but no stage hints', () => {
    const url = buildAddressUrl(
      '/render/button/default',
      'dark',
      { size: 'lg' },
      'https://x.dev',
    )
    expect(url.startsWith('https://x.dev/render/button/default?')).toBe(true)
    expect(url).toContain('theme=dark')
    expect(url).toContain('t.size=lg')
    expect(url).not.toContain('fit=1')
    expect(url).not.toContain('transparent=1')
  })

  test('stays relative with an empty origin (server / first render)', () => {
    expect(
      buildAddressUrl('/render/x/y', 'light', {}, '').startsWith(
        '/render/x/y?',
      ),
    ).toBe(true)
  })
})

describe('gridPad', () => {
  test('clamps to at least one grid cell when there is no slack', () => {
    expect(gridPad(100, 100)).toBe(MIN_PAD)
  })

  test('clamps to at most three grid cells when there is ample slack', () => {
    expect(gridPad(2000, 100)).toBe(MAX_PAD)
  })

  test('snaps the centered margin to a whole number of grid cells', () => {
    const pad = gridPad(400, 200)
    expect(pad % 16).toBe(0)
    expect(pad).toBeGreaterThanOrEqual(MIN_PAD)
    expect(pad).toBeLessThanOrEqual(MAX_PAD)
  })
})

describe('groupByLevel', () => {
  test('orders groups atoms-first and drops empty levels', () => {
    const groups = groupByLevel([
      comp({ id: 'page', level: 'page' }),
      comp({ id: 'atom', level: 'atom' }),
      comp({ id: 'mystery', level: null }),
    ])
    expect(groups.map((g) => g.key)).toEqual(['atom', 'page', 'unclassified'])
  })

  test('files a null level under the unclassified group', () => {
    const groups = groupByLevel([comp({ id: 'x', level: null })])
    expect(groups).toHaveLength(1)
    expect(groups[0].key).toBe('unclassified')
    expect(groups[0].components).toHaveLength(1)
  })
})

describe('groupPrimerSections', () => {
  const section = (over: Partial<PrimerSection>): PrimerSection => ({
    id: 's',
    title: 'S',
    kind: 'display',
    ...over,
  })

  test('folds displays under the heading that precedes them', () => {
    const groups = groupPrimerSections([
      section({ id: 'colors', kind: 'heading', title: 'Colors' }),
      section({ id: 'ramp' }),
      section({ id: 'swatches' }),
      section({ id: 'type', kind: 'heading', title: 'Type' }),
      section({ id: 'scale' }),
    ])
    expect(groups).toHaveLength(2)
    expect(groups[0].heading?.id).toBe('colors')
    expect(groups[0].items.map((i) => i.id)).toEqual(['ramp', 'swatches'])
    expect(groups[1].heading?.id).toBe('type')
    expect(groups[1].items.map((i) => i.id)).toEqual(['scale'])
  })

  test('puts displays before the first heading into a leading headless group', () => {
    const groups = groupPrimerSections([
      section({ id: 'wordmark' }),
      section({ id: 'intro', kind: 'heading', title: 'Intro' }),
    ])
    expect(groups[0].heading).toBeNull()
    expect(groups[0].items.map((i) => i.id)).toEqual(['wordmark'])
    expect(groups[1].heading?.id).toBe('intro')
  })
})
