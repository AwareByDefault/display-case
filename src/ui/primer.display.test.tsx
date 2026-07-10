import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ThemeSignal } from '../index'
import { Display, PrimerThemeSignals } from './primer'

/**
 * A forced-theme `<Display>` specimen must island the *full* configured signal set
 * on its subtree — not just `data-theme` — so a specimen pinned to a theme and
 * built with Bootstrap/MUI/a custom attribute re-themes. The primer seeds the
 * signal set through {@link PrimerThemeSignals} (from config on the server, from the
 * inlined set on the client).
 */
function renderSpecimen(
  signals: ThemeSignal[],
  theme?: 'light' | 'dark',
): string {
  return renderToStaticMarkup(
    <PrimerThemeSignals.Provider value={signals}>
      <Display title="Card" theme={theme}>
        <span>x</span>
      </Display>
    </PrimerThemeSignals.Provider>,
  )
}

describe('Display forced-theme specimen', () => {
  test('a dark-pinned specimen islands every configured attribute and the class', () => {
    const html = renderSpecimen(
      ['class', 'bootstrap', 'mui', { attribute: 'data-color-mode' }],
      'dark',
    )
    expect(html).toContain('data-theme="dark"')
    expect(html).toContain('data-bs-theme="dark"')
    expect(html).toContain('data-mui-color-scheme="dark"')
    expect(html).toContain('data-color-mode="dark"')
    expect(html).toContain('dc-display-specimen dark')
  })

  test('a light-pinned specimen islands attributes but not the uninheritable dark class', () => {
    const html = renderSpecimen(['class', 'bootstrap'], 'light')
    expect(html).toContain('data-theme="light"')
    expect(html).toContain('data-bs-theme="light"')
    // No dark class — a class cannot be un-inherited on a nested element.
    expect(html).not.toContain('dc-display-specimen dark')
  })

  test('an unpinned specimen carries no theme signals (inherits the page)', () => {
    const html = renderSpecimen(['bootstrap', 'mui'])
    expect(html).not.toContain('data-theme=')
    expect(html).not.toContain('data-bs-theme=')
    expect(html).not.toContain('data-mui-color-scheme=')
  })
})
