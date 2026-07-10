import { describe, expect, test } from 'bun:test'
// `useDark` aliased so the React-hooks lint doesn't misfire on a Vue composable.
import {
  getSSRHandler,
  setSSRHandler,
  useDark as vueUseDark,
} from '@vueuse/core'
import { nextTick } from 'vue'
import { DEFAULT_DARK_CLASS } from './theme-signals'

/**
 * Dep-backed check for the Vue ecosystem's convention. Display Case renders React,
 * so a Vue component tree cannot render in its host — but VueUse `useDark()` (the
 * common Vue dark-mode composable) themes by toggling a dark CLASS on the root,
 * exactly the convention Display Case's default `class` signal drives and the
 * Tailwind fixture exercises end-to-end.
 *
 * Rather than hard-code the class name, we DERIVE it from the library: `useDark`
 * routes DOM writes through VueUse's `updateHTMLAttrs` SSR handler (a public hook),
 * so we override it to capture the class value it applies for the dark mode — no
 * DOM needed. The test fails if VueUse changes its default or Display Case changes
 * its own, which is the point.
 */
describe('VueUse convention', () => {
  test("Display Case's default dark class equals @vueuse/core useDark's default", async () => {
    const original = getSSRHandler('updateHTMLAttrs', undefined)
    let vueUseDarkClass: string | undefined
    setSSRHandler('updateHTMLAttrs', (_selector, attribute, value) => {
      // `useDark` calls this with the mode's class value; the dark mode's value is
      // its `valueDark` default. The light default is `''` (skipped by the guard).
      if (attribute === 'class' && value) vueUseDarkClass = value
    })
    try {
      const isDark = vueUseDark()
      isDark.value = true
      await nextTick()
      expect(vueUseDarkClass).toBeDefined()
      expect(DEFAULT_DARK_CLASS).toBe(vueUseDarkClass as string)
    } finally {
      setSSRHandler('updateHTMLAttrs', original as never)
    }
  })
})
