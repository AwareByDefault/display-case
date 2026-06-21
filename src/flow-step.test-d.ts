/**
 * Type-level test for `flowStep` inference. Compiled by `tsc` (the `lint:types`
 * check) but never executed — each `@ts-expect-error` asserts a compile error,
 * and a `const x: T =` asserts the inferred type. A regression of the inference
 * fails the typecheck.
 */
import { flowStep, tweak } from './index'

// A tweaked step: `values` is typed from its own tweaks.
flowStep({
  tweaks: { error: tweak.boolean(false), code: tweak.text('') },
  render: ({ values }) => {
    const _error: boolean = values.error
    const _code: string = values.code
    void _error
    void _code
    // @ts-expect-error — `nope` is not a declared tweak of this step
    void values.nope
    return null
  },
})

// A step with no tweaks: `values` is empty; render need not read it.
flowStep({
  transitions: ['Done'],
  render: ({ goto }) => {
    goto('Done')
    return null
  },
})

// A no-tweaks step that wrongly reads a tweak value.
flowStep({
  render: ({ values }) => {
    // @ts-expect-error — this step declares no tweaks
    void values.error
    return null
  },
})
