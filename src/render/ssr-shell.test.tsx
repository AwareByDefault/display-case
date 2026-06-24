import { describe, expect, test } from 'bun:test'
import type { Manifest } from '../core/manifest'
import { renderShellToHtml } from './ssr-shell'

const manifest: Manifest = {
  title: 'Showcase',
  components: [
    {
      id: 'button',
      name: 'Button',
      level: 'atom',
      isFlow: false,
      group: [],
      caseFile: 'src/Button.case.tsx',
      placardDoc: null,
      cases: [
        {
          id: 'default',
          name: 'Default',
          browseUrl: '/c/button/default',
          renderUrl: '/render/button/default',
          tweaks: null,
          transitions: [],
        },
      ],
    },
  ],
  groups: [],
  modes: ['components'],
  landing: 'components',
}

describe('renderShellToHtml', () => {
  test('server-renders the browse chrome to markup', () => {
    const result = renderShellToHtml({
      manifest,
      pathname: '/c/button/default',
      search: '',
      theme: 'dark',
      a11y: false,
    })
    expect(result.ssr).toBe(true)
    expect(result.html.length).toBeGreaterThan(0)
    // The seeded component name reaches the rendered nav.
    expect(result.html).toContain('Button')
  })

  test('renders the primer landing without throwing when one is configured', () => {
    const result = renderShellToHtml({
      manifest: {
        ...manifest,
        modes: ['primer', 'components'],
        landing: 'primer',
      },
      pathname: '/',
      search: '',
      theme: 'light',
      a11y: true,
    })
    expect(result.ssr).toBe(true)
    expect(result.html.length).toBeGreaterThan(0)
  })
})
