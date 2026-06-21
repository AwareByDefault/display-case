/**
 * Type-level test for the style-engine seam. Compiled by `tsc` (the `lint:types`
 * check) but never executed — `const x: T =` assertions pin the public shapes,
 * and `@ts-expect-error` asserts a compile error. A regression of the types
 * fails the typecheck.
 */
import type { DisplayCaseConfig, StyleCollector, StyleEngine } from './index'

// A StyleEngine is a zero-arg factory returning a StyleCollector.
const engine: StyleEngine = () => ({
  wrap: (node) => node,
  collect: (html) => `<style>${html.length}</style>`,
})

// A collector's methods have the expected signatures.
const collector: StyleCollector = engine()
const _wrapped = collector.wrap(null)
const _css: string = collector.collect('<div/>')
void _wrapped
void _css

// `styleEngines` is an optional array of engines on the config.
const config: DisplayCaseConfig = {
  title: 'T',
  roots: [],
  styleEngines: [engine],
}
void config

// collect must return a string — returning a non-string is a type error.
// @ts-expect-error — collect returns void, not string
const _bad: StyleCollector = { wrap: (n) => n, collect: () => {} }
void _bad

// @ts-expect-error — a StyleEngine takes no arguments
const _badEngine: StyleEngine = (_x: number) => engine()
void _badEngine
