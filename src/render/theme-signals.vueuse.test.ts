import { describe, expect, test } from 'bun:test'
import * as vueuse from '@vueuse/core'
import { DEFAULT_DARK_CLASS } from './theme-signals'

/**
 * Dep-backed check for the Vue ecosystem's convention. Display Case renders React,
 * so a Vue component tree cannot render in its host — but VueUse `useDark()` (the
 * common Vue dark-mode composable) themes by toggling a `dark` CLASS on the root,
 * which is exactly the convention Display Case's default `class` signal drives and
 * the Tailwind fixture exercises end-to-end. This pins that the class names agree,
 * with `@vueuse/core` installed as a real dependency.
 */
describe('VueUse convention', () => {
  test('@vueuse/core is installed and exposes useDark', () => {
    expect(typeof vueuse.useDark).toBe('function')
  })

  test("Display Case's default dark class matches VueUse's `useDark` default", () => {
    // VueUse `useDark` defaults to `attribute: 'class', valueDark: 'dark'`.
    expect(DEFAULT_DARK_CLASS).toBe('dark')
  })
})
