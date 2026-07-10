import type { DisplayCaseConfig, ThemeSignal } from '../index'
import type { Theme } from '../ui/shell-core'

/**
 * Resolving the preview theme to the document-root indicators to apply.
 *
 * There is no single cross-framework standard for how a component detects
 * light/dark, so Display Case emits a configurable set of root signals (see
 * {@link ThemeSignal}). This resolver maps a {@link Theme} + the configured
 * signals to a plain description of what to put on the root — consumed identically
 * by the server (baked into the document delivered before scripting) and the
 * client (applied to the live DOM on an in-place toggle), so the two never drift.
 * It is pure and touches no `document`/`window`; the client applier takes the root
 * element as an argument.
 */

/** The document-root indicators for one theme. */
export interface ResolvedThemeSignals {
  /** Attributes to set on the root for this theme (name → value). */
  attributes: Record<string, string>
  /** Classes to add on the root for this theme. */
  addClasses: string[]
  /** Classes to remove (they belong to the *other* theme) so an in-place toggle
   *  cleans up instead of accumulating both themes' classes. */
  removeClasses: string[]
  /** The CSS `color-scheme` value for this theme. */
  colorScheme: Theme
}

/** The consumer signals emitted when a showcase declares no `theme` config — the
 *  Tailwind/shadcn/VueUse dark-class convention, the single largest ecosystem. */
export const DEFAULT_THEME_SIGNALS: readonly ThemeSignal[] = ['class']

/** The effective signal set for a config: the configured list, or the default. */
export function effectiveThemeSignals(
  config: Pick<DisplayCaseConfig, 'theme'>,
): readonly ThemeSignal[] {
  return config.theme?.signals ?? DEFAULT_THEME_SIGNALS
}

/** The class toggled by the `'class'` signal in the dark theme (dark-only). */
export const DEFAULT_DARK_CLASS = 'dark'

/**
 * Map a theme + the configured consumer signals to the root indicators to apply.
 * Display Case's own `data-theme`, `data-theme-pref`, and `color-scheme` are
 * always present; the signals add the consumer conventions on top.
 */
export function resolveThemeSignals(
  theme: Theme,
  signals: readonly ThemeSignal[],
): ResolvedThemeSignals {
  // Always present: the showcase's own tokens key off `data-theme`;
  // `data-theme-pref` stops a consumer `ThemeProvider` re-resolving from the OS and
  // fighting the selection; `color-scheme` themes user-agent controls and is what
  // `light-dark()` reads.
  const attributes: Record<string, string> = {
    'data-theme': theme,
    'data-theme-pref': theme,
  }
  const addClasses: string[] = []
  const removeClasses: string[] = []
  const isDark = theme === 'dark'

  for (const signal of signals) {
    if (signal === 'data-theme' || signal === 'color-scheme') {
      // Always emitted anyway; the explicit form is a no-op.
      continue
    }
    if (signal === 'class') {
      // Dark-only, matching Tailwind/shadcn/VueUse (`valueLight: ''`): add the
      // dark class in the dark theme, and ensure it is gone in the light theme.
      ;(isDark ? addClasses : removeClasses).push(DEFAULT_DARK_CLASS)
      continue
    }
    if (signal === 'bootstrap') {
      attributes['data-bs-theme'] = theme
      continue
    }
    if (signal === 'mui') {
      attributes['data-mui-color-scheme'] = theme
      continue
    }
    if ('attribute' in signal) {
      attributes[signal.attribute] = isDark
        ? (signal.dark ?? 'dark')
        : (signal.light ?? 'light')
      continue
    }
    // Custom class: dark-only unless a light class is also given.
    if (isDark) {
      addClasses.push(signal.class)
      if (signal.light) removeClasses.push(signal.light)
    } else {
      removeClasses.push(signal.class)
      if (signal.light) addClasses.push(signal.light)
    }
  }

  return { attributes, addClasses, removeClasses, colorScheme: theme }
}

const ATTR_ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '"': '&quot;',
  '<': '&lt;',
  '>': '&gt;',
}

function escapeAttr(value: string): string {
  return value.replace(/[&"<>]/g, (c) => ATTR_ESCAPE[c] ?? c)
}

/**
 * Render the resolved signals as the attribute string for the document root's
 * opening `<html …>` tag (leading space included), e.g.
 * ` data-theme="dark" data-theme-pref="dark" class="dark"`. `removeClasses` is
 * irrelevant server-side (nothing to remove on a fresh document). Used by the
 * document builders so the delivered markup already carries every configured
 * indicator for the requested theme.
 */
export function themeRootAttrs(resolved: ResolvedThemeSignals): string {
  const parts = Object.entries(resolved.attributes).map(
    ([name, value]) => `${name}="${escapeAttr(value)}"`,
  )
  if (resolved.addClasses.length > 0) {
    parts.push(`class="${escapeAttr(resolved.addClasses.join(' '))}"`)
  }
  return parts.length > 0 ? ` ${parts.join(' ')}` : ''
}

/**
 * Apply the resolved signals to a root element on the client — set/overwrite the
 * attributes, add/remove the theme classes, and set `color-scheme`. Idempotent on
 * first load (equals what the document baked in) and correct on every in-place
 * theme swap. Takes the element so it stays free of global `document` access.
 */
export function applyResolvedSignals(
  root: HTMLElement,
  resolved: ResolvedThemeSignals,
): void {
  for (const [name, value] of Object.entries(resolved.attributes)) {
    root.setAttribute(name, value)
  }
  for (const cls of resolved.removeClasses) root.classList.remove(cls)
  for (const cls of resolved.addClasses) root.classList.add(cls)
  root.style.colorScheme = resolved.colorScheme
}

const THEME_SIGNALS_GLOBAL = '__dcThemeSignals'

/** Inline script that publishes the effective signal set to the client, so the
 *  in-place theme toggle re-emits exactly what the server baked. Placed in every
 *  delivered document. */
export function themeSignalsSeedScript(
  signals: readonly ThemeSignal[],
): string {
  return `<script>window.${THEME_SIGNALS_GLOBAL}=${JSON.stringify(signals)}</script>`
}

/** Read the effective signal set the server inlined; falls back to the default set
 *  if a document predates the inline (defensive). Client-only. */
export function readThemeSignals(): readonly ThemeSignal[] {
  const fromDoc = (globalThis as { [THEME_SIGNALS_GLOBAL]?: ThemeSignal[] })
    .__dcThemeSignals
  return Array.isArray(fromDoc) ? fromDoc : DEFAULT_THEME_SIGNALS
}
