import { afterEach, describe, expect, test } from 'bun:test'
import type { Manifest } from '../core/manifest'
import { primerForLocation } from './shell-core'

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
