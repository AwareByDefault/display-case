import { afterEach, describe, expect, test } from 'bun:test'
import type { ThemeSignal } from '../index'
import {
  applyResolvedSignals,
  DEFAULT_THEME_SIGNALS,
  effectiveThemeSignals,
  readThemeSignals,
  resolveThemeSignals,
  themeRootAttrs,
  themeSignalsSeedScript,
} from './theme-signals'

describe('resolveThemeSignals', () => {
  test('always emits data-theme, data-theme-pref, and color-scheme', () => {
    for (const theme of ['light', 'dark'] as const) {
      const r = resolveThemeSignals(theme, [])
      expect(r.attributes['data-theme']).toBe(theme)
      expect(r.attributes['data-theme-pref']).toBe(theme)
      expect(r.colorScheme).toBe(theme)
      expect(r.addClasses).toEqual([])
      expect(r.removeClasses).toEqual([])
    }
  })

  test('the class signal is dark-only: adds `dark` in dark, removes it in light', () => {
    const dark = resolveThemeSignals('dark', ['class'])
    expect(dark.addClasses).toEqual(['dark'])
    expect(dark.removeClasses).toEqual([])

    const light = resolveThemeSignals('light', ['class'])
    expect(light.addClasses).toEqual([])
    // Removed so an in-place toggle from dark cleans up.
    expect(light.removeClasses).toEqual(['dark'])
  })

  test('bootstrap and mui set their attributes to the theme value', () => {
    const r = resolveThemeSignals('dark', ['bootstrap', 'mui'])
    expect(r.attributes['data-bs-theme']).toBe('dark')
    expect(r.attributes['data-mui-color-scheme']).toBe('dark')
    const l = resolveThemeSignals('light', ['bootstrap', 'mui'])
    expect(l.attributes['data-bs-theme']).toBe('light')
    expect(l.attributes['data-mui-color-scheme']).toBe('light')
  })

  test('explicit data-theme / color-scheme signals are no-ops (already always-on)', () => {
    const base = resolveThemeSignals('dark', [])
    const explicit = resolveThemeSignals('dark', ['data-theme', 'color-scheme'])
    expect(explicit).toEqual(base)
  })

  test('a custom attribute uses default light/dark values or the given ones', () => {
    const def = resolveThemeSignals('dark', [{ attribute: 'data-color-mode' }])
    expect(def.attributes['data-color-mode']).toBe('dark')
    const custom = resolveThemeSignals('light', [
      { attribute: 'data-scheme', light: 'day', dark: 'night' },
    ])
    expect(custom.attributes['data-scheme']).toBe('day')
    const customDark = resolveThemeSignals('dark', [
      { attribute: 'data-scheme', light: 'day', dark: 'night' },
    ])
    expect(customDark.attributes['data-scheme']).toBe('night')
  })

  test('a custom class is dark-only unless a light class is given', () => {
    const darkOnly = resolveThemeSignals('light', [{ class: 'night' }])
    expect(darkOnly.addClasses).toEqual([])
    expect(darkOnly.removeClasses).toEqual(['night'])

    const paired = resolveThemeSignals('light', [
      { class: 'night', light: 'day' },
    ])
    expect(paired.addClasses).toEqual(['day'])
    expect(paired.removeClasses).toEqual(['night'])
  })

  test('a paired custom class in the dark theme adds the dark class and sheds the light one', () => {
    const dark = resolveThemeSignals('dark', [{ class: 'night', light: 'day' }])
    expect(dark.addClasses).toEqual(['night'])
    // Toggling to dark must remove the paired light class it added under light.
    expect(dark.removeClasses).toEqual(['day'])
  })

  test('rejects an invalid custom attribute name (server/client would diverge)', () => {
    expect(() =>
      resolveThemeSignals('dark', [{ attribute: 'bad name' }]),
    ).toThrow(/attribute name/)
    expect(() => resolveThemeSignals('dark', [{ attribute: '' }])).toThrow()
    // A valid one does not throw.
    expect(() =>
      resolveThemeSignals('dark', [{ attribute: 'data-color-mode' }]),
    ).not.toThrow()
  })

  test('rejects an invalid custom class name (whitespace / empty)', () => {
    expect(() => resolveThemeSignals('dark', [{ class: 'a b' }])).toThrow(
      /class name/,
    )
    expect(() => resolveThemeSignals('dark', [{ class: '' }])).toThrow()
    expect(() =>
      resolveThemeSignals('dark', [{ class: 'night', light: 'a b' }]),
    ).toThrow()
  })
})

describe('themeRootAttrs', () => {
  test('renders attributes and the class as an html attribute string', () => {
    const attrs = themeRootAttrs(resolveThemeSignals('dark', ['class']))
    expect(attrs).toBe(' data-theme="dark" data-theme-pref="dark" class="dark"')
  })

  test('omits the class attribute when there are no classes to add', () => {
    const attrs = themeRootAttrs(resolveThemeSignals('light', ['class']))
    expect(attrs).toBe(' data-theme="light" data-theme-pref="light"')
    expect(attrs).not.toContain('class=')
  })

  test('escapes attribute values so a custom value cannot break the tag', () => {
    const attrs = themeRootAttrs(
      resolveThemeSignals('dark', [{ attribute: 'data-x', dark: 'a"b<c>&d' }]),
    )
    expect(attrs).toContain('data-x="a&quot;b&lt;c&gt;&amp;d"')
  })
})

describe('effectiveThemeSignals', () => {
  test('defaults to the class convention when no theme config is given', () => {
    expect(effectiveThemeSignals({})).toBe(DEFAULT_THEME_SIGNALS)
    expect(DEFAULT_THEME_SIGNALS).toEqual(['class'])
  })

  test('uses the configured signals when provided (including an empty list)', () => {
    const signals: ThemeSignal[] = ['bootstrap', { attribute: 'data-x' }]
    expect(effectiveThemeSignals({ theme: { signals } })).toBe(signals)
    expect(effectiveThemeSignals({ theme: { signals: [] } })).toEqual([])
  })
})

describe('client transport (themeSignalsSeedScript ↔ readThemeSignals)', () => {
  const g = globalThis as { __dcThemeSignals?: unknown }
  afterEach(() => {
    delete g.__dcThemeSignals
  })

  test('what the seed script publishes is what readThemeSignals reads back', () => {
    const signals: ThemeSignal[] = [
      'class',
      'bootstrap',
      { attribute: 'data-color-mode' },
      { class: 'night' },
    ]
    const script = themeSignalsSeedScript(signals)
    expect(script.startsWith('<script>window.__dcThemeSignals=')).toBe(true)
    // Round-trip: run the assignment the browser would, then read it back.
    const json = script
      .replace('<script>window.__dcThemeSignals=', '')
      .replace('</script>', '')
    g.__dcThemeSignals = JSON.parse(json)
    expect(readThemeSignals()).toEqual(signals)
  })

  test('readThemeSignals falls back to the default when the global is absent', () => {
    delete g.__dcThemeSignals
    expect(readThemeSignals()).toBe(DEFAULT_THEME_SIGNALS)
  })

  test('readThemeSignals falls back to the default when the global is not an array', () => {
    g.__dcThemeSignals = { not: 'an array' }
    expect(readThemeSignals()).toBe(DEFAULT_THEME_SIGNALS)
  })

  test('the seed script escapes `<` so a value cannot break out of the <script> tag', () => {
    const signals: ThemeSignal[] = [
      { attribute: 'data-x', dark: '</script><b>hi', light: 'ok' },
    ]
    const script = themeSignalsSeedScript(signals)
    // The only literal `</script>` is the tag's own closer.
    expect(script.match(/<\/script>/g)).toHaveLength(1)
    expect(script).toContain('\\u003c')
    // …and the value still round-trips through JSON.parse.
    const json = script
      .replace('<script>window.__dcThemeSignals=', '')
      .replace(/<\/script>$/, '')
    expect(JSON.parse(json)).toEqual(signals)
  })
})

describe('server/client parity (no flash, no drift)', () => {
  // The server bakes `themeRootAttrs` into the document and the client applies
  // `applyResolvedSignals`; both derive from the same `resolveThemeSignals`, so a
  // fresh document and the client's first application must agree. Assert the baked
  // attribute string carries exactly the attributes + class the client would set.
  const signals: ThemeSignal[] = [
    'class',
    'bootstrap',
    'mui',
    { attribute: 'data-color-mode' },
    { class: 'night' },
  ]
  for (const theme of ['light', 'dark'] as const) {
    test(`baked attributes match applied attributes for a configured set (${theme})`, () => {
      const resolved = resolveThemeSignals(theme, signals)
      const baked = themeRootAttrs(resolved)
      // Every always-on + configured attribute the client sets is in the markup.
      for (const [name, value] of Object.entries(resolved.attributes)) {
        expect(baked).toContain(`${name}="${value}"`)
      }
      // The class(es) the client adds are baked; the ones it removes are absent.
      if (resolved.addClasses.length > 0) {
        expect(baked).toContain(`class="${resolved.addClasses.join(' ')}"`)
      } else {
        expect(baked).not.toContain('class=')
      }
      for (const removed of resolved.removeClasses) {
        expect(baked).not.toContain(`class="${removed}"`)
      }
    })
  }
})

describe('applyResolvedSignals', () => {
  // A minimal fake root that records the DOM writes, so the applier is testable
  // without a full DOM. Mirrors the subset of HTMLElement the applier touches.
  function fakeRoot() {
    const classes = new Set<string>()
    return {
      attrs: {} as Record<string, string>,
      classes,
      style: { colorScheme: '' },
      setAttribute(name: string, value: string) {
        this.attrs[name] = value
      },
      classList: {
        add: (c: string) => classes.add(c),
        remove: (c: string) => classes.delete(c),
      },
    }
  }

  test('sets attributes, adds/removes classes, and sets color-scheme', () => {
    const root = fakeRoot()
    root.classes.add('dark') // pretend the previous (dark) theme left it
    applyResolvedSignals(
      root as unknown as HTMLElement,
      resolveThemeSignals('light', ['class', 'bootstrap']),
    )
    expect(root.attrs['data-theme']).toBe('light')
    expect(root.attrs['data-bs-theme']).toBe('light')
    expect(root.classes.has('dark')).toBe(false) // removed on toggle to light
    expect(root.style.colorScheme).toBe('light')
  })

  test('adds the dark class when toggling to dark', () => {
    const root = fakeRoot()
    applyResolvedSignals(
      root as unknown as HTMLElement,
      resolveThemeSignals('dark', ['class']),
    )
    expect(root.classes.has('dark')).toBe(true)
    expect(root.style.colorScheme).toBe('dark')
  })
})
