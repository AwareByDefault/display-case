import { afterEach, describe, expect, test } from 'bun:test'
import type { Manifest, ManifestComponent } from '../core/manifest'
import {
  buildAddressUrl,
  buildExhibitView,
  buildRenderSrc,
  buildUrl,
  clampSidebarWidth,
  componentMatchesFilter,
  gridPad,
  groupByLevel,
  groupPrimerSections,
  humanizeTweakKey,
  initialSelectionFor,
  MAX_PAD,
  MIN_PAD,
  type PrimerSection,
  parseRoute,
  primerForLocation,
  resolveMode,
  type Selection,
  SIDEBAR_MAX_W,
  SIDEBAR_MIN_W,
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
    groups: [],
    modes: ['primer', 'components', 'exhibits'],
    landing: 'primer',
    ...over,
  }
}

describe('primerForLocation', () => {
  test('the /primer route is the Primer whenever one is present', () => {
    atPath('/primer')
    // Even when the landing is a catalog mode, an explicit /primer link still
    // resolves to the Primer.
    expect(primerForLocation(manifest({ landing: 'components' }))).toBe(true)
  })

  test('the /primer route falls back when no Primer is present', () => {
    atPath('/primer')
    expect(
      primerForLocation(
        manifest({ modes: ['components'], landing: 'components' }),
      ),
    ).toBe(false)
  })

  test('the bare / landing honors the resolved landing', () => {
    atPath('/')
    expect(primerForLocation(manifest({ landing: 'primer' }))).toBe(true)
    expect(primerForLocation(manifest({ landing: 'components' }))).toBe(false)
  })

  test('a /c/... deep link is never the Primer', () => {
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
    group: [],
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

  test('/primer resolves to the primer only when one is present', () => {
    expect(resolveMode(route('/primer'), manifest({}))).toBe('primer')
    expect(
      resolveMode(
        route('/primer'),
        manifest({ modes: ['components'], landing: 'components' }),
      ),
    ).toBe('components')
  })

  test('the path prefix selects the catalog mode', () => {
    expect(resolveMode(route('/c/button/default'), manifest({}))).toBe(
      'components',
    )
    expect(resolveMode(route('/e/pricing/default'), manifest({}))).toBe(
      'exhibits',
    )
  })

  test('a prefix for an absent mode falls back to the landing', () => {
    expect(
      resolveMode(
        route('/e/pricing/default'),
        manifest({ modes: ['components'], landing: 'components' }),
      ),
    ).toBe('components')
  })

  test('the bare / landing honors the resolved landing', () => {
    expect(resolveMode(route('/'), manifest({ landing: 'primer' }))).toBe(
      'primer',
    )
    expect(resolveMode(route('/'), manifest({ landing: 'exhibits' }))).toBe(
      'exhibits',
    )
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
    const r = parseRoute(path!, `?${search}`)
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
  test('orders the kit atoms-first, drops empty levels, and excludes surfaces', () => {
    const groups = groupByLevel([
      // A surface (page) belongs to the Exhibits mode — not the kit grouping.
      comp({ id: 'page', level: 'page' }),
      comp({ id: 'organism', level: 'organism' }),
      comp({ id: 'atom', level: 'atom' }),
      comp({ id: 'mystery', level: null }),
    ])
    expect(groups.map((g) => g.key)).toEqual([
      'atom',
      'organism',
      'unclassified',
    ])
  })

  test('files a null level under the unclassified group', () => {
    const groups = groupByLevel([comp({ id: 'x', level: null })])
    expect(groups).toHaveLength(1)
    expect(groups[0]!.key).toBe('unclassified')
    expect(groups[0]!.components).toHaveLength(1)
  })
})

describe('clampSidebarWidth', () => {
  test('clamps to the min and max bounds and passes values within range', () => {
    expect(clampSidebarWidth(SIDEBAR_MIN_W - 100)).toBe(SIDEBAR_MIN_W)
    expect(clampSidebarWidth(SIDEBAR_MAX_W + 100)).toBe(SIDEBAR_MAX_W)
    const mid = Math.round((SIDEBAR_MIN_W + SIDEBAR_MAX_W) / 2)
    expect(clampSidebarWidth(mid)).toBe(mid)
  })
})

describe('buildUrl mode prefix', () => {
  test('a kit case routes under /c/ and a surface under /e/', () => {
    expect(buildUrl('button', 'default', {}, false, false)).toBe(
      '/c/button/default',
    )
    expect(buildUrl('pricing', 'default', {}, false, true)).toBe(
      '/e/pricing/default',
    )
  })
})

describe('componentMatchesFilter', () => {
  test('matches by name, case name, or group segment; empty filter matches all', () => {
    const c = comp({
      name: 'Pricing',
      group: ['Marketing'],
      cases: [
        {
          id: 'error',
          name: 'Error',
          browseUrl: '',
          renderUrl: '',
          tweaks: null,
          transitions: [],
        },
      ],
    })
    expect(componentMatchesFilter(c, 'pric')).toBe(true)
    expect(componentMatchesFilter(c, 'market')).toBe(true)
    expect(componentMatchesFilter(c, 'error')).toBe(true)
    expect(componentMatchesFilter(c, '')).toBe(true)
    expect(componentMatchesFilter(c, 'zzz')).toBe(false)
  })
})

describe('buildExhibitView', () => {
  test('places surfaces under their group, lists ungrouped first, and excludes the kit', () => {
    const m = manifest({
      groups: [
        {
          label: 'Marketing',
          path: ['Marketing'],
          collapsed: false,
          children: [],
        },
      ],
      components: [
        comp({ id: 'pricing', level: 'page', group: ['Marketing'] }),
        comp({ id: 'welcome', level: 'page', group: [] }),
        comp({ id: 'button', level: 'atom', group: [] }),
      ],
    })
    const view = buildExhibitView(m)
    // Only surfaces appear; the kit (button) is excluded.
    expect(view.ungrouped.map((c) => c.id)).toEqual(['welcome'])
    expect(view.tree).toHaveLength(1)
    expect(view.tree[0]!.label).toBe('Marketing')
    expect(view.tree[0]!.components.map((c) => c.id)).toEqual(['pricing'])
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
    expect(groups[0]!.heading?.id).toBe('colors')
    expect(groups[0]!.items.map((i) => i.id)).toEqual(['ramp', 'swatches'])
    expect(groups[1]!.heading?.id).toBe('type')
    expect(groups[1]!.items.map((i) => i.id)).toEqual(['scale'])
  })

  test('puts displays before the first heading into a leading headless group', () => {
    const groups = groupPrimerSections([
      section({ id: 'wordmark' }),
      section({ id: 'intro', kind: 'heading', title: 'Intro' }),
    ])
    expect(groups[0]!.heading).toBeNull()
    expect(groups[0]!.items.map((i) => i.id)).toEqual(['wordmark'])
    expect(groups[1]!.heading?.id).toBe('intro')
  })
})

describe('humanizeTweakKey', () => {
  test('splits camelCase and capitalizes the first word', () => {
    expect(humanizeTweakKey('camelCase')).toBe('Camel Case')
  })

  test('keeps a clumped acronym together, ceding its last letter to the next word', () => {
    expect(humanizeTweakKey('thisURLAcronymShouldStayTogether')).toBe(
      'This URL Acronym Should Stay Together',
    )
  })

  test('splits on underscores and whitespace', () => {
    expect(humanizeTweakKey('snake_case_key')).toBe('Snake case key')
    expect(humanizeTweakKey('spaced  words')).toBe('Spaced words')
  })

  test('splits digit-to-letter camel boundaries', () => {
    expect(humanizeTweakKey('enableX2Mode')).toBe('Enable X2 Mode')
  })

  test('capitalizes only the first word, leaving the rest as authored', () => {
    expect(humanizeTweakKey('size')).toBe('Size')
    expect(humanizeTweakKey('kind')).toBe('Kind')
  })

  test('handles a leading acronym and empty input', () => {
    expect(humanizeTweakKey('URLPath')).toBe('URL Path')
    expect(humanizeTweakKey('')).toBe('')
  })
})
