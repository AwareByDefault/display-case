/**
 * Type-level test for the `theme` config seam. Compiled by `tsc` (the type check)
 * but never executed — assignments pin the public shapes and `@ts-expect-error`
 * asserts a compile error. A regression of the `ThemeConfig` / `ThemeSignal`
 * types fails the typecheck.
 */
import type { DisplayCaseConfig, ThemeConfig, ThemeSignal } from './index'

// Named-convention signals.
const named: ThemeSignal[] = [
  'class',
  'bootstrap',
  'mui',
  'data-theme',
  'color-scheme',
]
void named

// Custom attribute and class mappings.
const customAttr: ThemeSignal = {
  attribute: 'data-color-mode',
  light: 'l',
  dark: 'd',
}
const customClass: ThemeSignal = { class: 'night', light: 'day' }
void customAttr
void customClass

// The config accepts a `theme` with an optional `signals` list.
const withTheme: DisplayCaseConfig = {
  title: 'T',
  roots: [],
  theme: { signals: ['class', 'bootstrap', { attribute: 'data-x' }] },
}
void withTheme

// `signals` is optional; an empty ThemeConfig is valid.
const emptyTheme: ThemeConfig = {}
void emptyTheme

// A signal MUST be declarative data — a function is not assignable (it could not be
// serialized to the client, which is the whole point of the declarative design).
// @ts-expect-error — a function is not a valid ThemeSignal
const fnSignal: ThemeSignal = (theme: string) => theme
void fnSignal

// @ts-expect-error — an unknown named convention is rejected
const unknownNamed: ThemeSignal = 'tailwind'
void unknownNamed

// @ts-expect-error — a custom attribute mapping must name the attribute
const attrMissingName: ThemeSignal = { light: 'l', dark: 'd' }
void attrMissingName
