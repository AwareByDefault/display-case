import { describe, expect, test } from 'bun:test'
import type { ThemeSignal } from '../index'
import {
  applyResolvedSignals,
  DEFAULT_THEME_SIGNALS,
  effectiveThemeSignals,
  resolveThemeSignals,
  themeRootAttrs,
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
