import { resolve } from 'node:path'
import type { ReactNode } from 'react'
import type {
  SerializedFrame,
  Substrate,
  SubstrateDocumentContext,
  SubstrateRenderContext,
  SubstrateVariantAxis,
} from '../core/substrate'
import type { RenderDriver } from '../index'
import { renderWithStyles } from '../render/collect-styles'
import { importMap } from '../render/documents'
import {
  effectiveThemeSignals,
  resolveThemeSignals,
  themeRootAttrs,
  themeSignalsSeedScript,
} from '../render/theme-signals'
import { DEVICES, RESPONSIVE, type Theme } from '../ui/shell-core'

/**
 * The built-in DOM substrate: React rendered to HTML, delivered as a browser
 * document, hydrated by a browser bundle.
 *
 * This is Display Case's default and — until a second substrate exists — its
 * only implementation. Extracting it behind the {@link Substrate} contract is
 * deliberately a *no-op*: every document it produces is byte-identical to the
 * one the hard-wired renderer produced, because the interface was designed
 * around what this path already does rather than the other way round.
 *
 * Two things that used to be separate now come through here: the dev server's
 * render document and the published build's render document differed only by an
 * importmap (published only) and the live-reload/error-overlay injects (dev
 * only). Both are parameters of the same template — `ctx.importmap` and
 * `ctx.hostScripts` — so the two templates collapse into one without either
 * output changing.
 */

/**
 * What a DOM render produces. Opaque to Display Case's core (see the `Frame`
 * contract): `headStyles` in particular is a DOM-only concern — style-engine
 * output for the document `<head>` — and lives here rather than in any shared
 * result type.
 */
export interface DomFrame {
  /** Pre-rendered `#root` inner markup; `''` when the case is client-only. */
  html: string
  /** True when the case could not be rendered outside a browser (it threw under
   *  `renderToString`, or is declared `browserOnly`, or does not exist). */
  browserOnly: boolean
  /** The throw's message, for the server to log once per browser-only case. */
  error?: string
  /** Render-time (CSS-in-JS) styling collected by the configured style engines,
   *  as `<head>` markup placed after the document's static styles. `''` when no
   *  engine is configured or none produced styling. */
  headStyles: string
}

export interface DomSubstrateOptions {
  /**
   * Render-driver factory for the visual/a11y capture — a headless browser that
   * opens a render address, screenshots it, and runs axe. Defaults to the
   * built-in Playwright + axe driver, loaded lazily so the toolchain stays an
   * optional dependency.
   *
   * This is browser-shaped by nature, which is exactly why it belongs to *this*
   * substrate rather than to the substrate contract: a substrate that
   * serializes frames directly has no driver, because `render()` + `serialize()`
   * already is the capture.
   */
  driver?: () => RenderDriver | Promise<RenderDriver>
}

/** The theme axis: light/dark, selecting a different rendering. */
const THEME_AXIS: SubstrateVariantAxis = {
  id: 'theme',
  label: 'Theme',
  kind: 'render',
  values: [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ],
  default: 'light',
}

/**
 * The viewport axis: how wide the stage is, presented around an unchanged
 * rendering. It constrains the embedded stage rather than the document inside
 * it, which is what makes it a `stage` axis — switching it needs no re-render.
 */
const VIEWPORT_AXIS: SubstrateVariantAxis = {
  id: 'viewport',
  label: 'Viewport',
  kind: 'stage',
  values: [
    ...RESPONSIVE.map((p) => ({ value: p.id, label: p.label })),
    ...DEVICES.map((d) => ({
      value: d.id,
      label: `${d.label} (${d.w}×${d.h})`,
    })),
  ],
  default: 'full',
}

/** Read the theme off a render context, defaulting as the axis declares. */
function themeOf(ctx: { variants: Record<string, string> }): Theme {
  return ctx.variants.theme === 'dark' ? 'dark' : 'light'
}

/**
 * Build the isolated render document. Shared by the dev server, the published
 * build, and the render subcommand, so all three deliver the same bytes for the
 * same case — the property that makes a snapshot reproducible.
 */
function domDocument(frame: DomFrame, ctx: SubstrateDocumentContext): string {
  const theme = themeOf(ctx)
  const signals = effectiveThemeSignals(ctx.config)
  // Decorated exhibits (atoms…templates, marked `data-decorated` by the mount)
  // center their content in the frame: when the exhibit wraps or is narrower
  // than the frame, its rows sit centered rather than top-left. Inline styles on
  // a case still win, so an author can opt back to `flex-start`. Pages/flows are
  // excluded — they own their full-bleed layout and must not be re-centered.
  const exhibitCenter =
    'body[data-decorated] #root>*{justify-content:center;align-content:center}'
  const bodyAttrs =
    ctx.params.transparent === '1'
      ? ' data-decorated style="background:transparent"'
      : ''
  // `data-ssr` tells the client whether to adopt the delivered markup (1) or
  // mount fresh (0 — a client-only case that produced no server markup).
  const rootAttrs = `${ctx.params.fit === '1' ? ' style="width:fit-content"' : ''} data-ssr="${ctx.prerendered ? '1' : '0'}"`
  const htmlAttrs = themeRootAttrs(resolveThemeSignals(theme, signals))
  const { globalCss, vitrineCss } = ctx.resources
  // The Vitrine stylesheet follows globalCss so a dogfooded design-system case
  // paints before scripts; for a non-dogfooding consumer these are inert chrome
  // rules in a preview document.
  //
  // The style engines' collected styling (if any) follows the static <style>
  // block as its own discrete markup — emotion/styled-components tag their
  // output with attributes the client runtime keys on to adopt it, so it must
  // not be folded into the block above. Empty when no engine is configured,
  // which keeps the document byte-identical to its engine-free form.
  const script = ctx.scriptSrc
    ? `<script type="module" src="${ctx.scriptSrc}"></script>`
    : ''
  return `<!doctype html><html lang="en"${htmlAttrs}><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Display Case render</title><style>html,body{margin:0}html{color-scheme:${theme}}body{background:var(--color-bg);color:var(--color-fg);font-family:var(--font-sans, ui-sans-serif, system-ui, sans-serif)}${exhibitCenter}${globalCss}\n${vitrineCss}</style>${frame.headStyles}${importMap(ctx.importmap)}</head><body${bodyAttrs}><main id="root"${rootAttrs}>${frame.html}</main>${themeSignalsSeedScript(signals)}${ctx.hostScripts}${script}</body></html>`
}

/**
 * The DOM substrate, plus the browser driver it captures through.
 *
 * `driver` sits on the substrate rather than in {@link SubstrateChecks} because
 * it is irreducibly browser-shaped: it opens a URL, paints it, screenshots it,
 * and runs axe. The substrate contract's `capture` is the medium-neutral shape;
 * this is how *this* medium satisfies it.
 */
export interface DomSubstrate extends Substrate<DomFrame> {
  /** Render-driver factory; `undefined` ⇒ the lazily-loaded built-in default. */
  driver?: () => RenderDriver | Promise<RenderDriver>
}

/**
 * The DOM substrate. Pass it explicitly to configure it
 * (`domSubstrate({ driver })`); a showcase that configures no substrate gets
 * this one with default options.
 */
export function domSubstrate(opts: DomSubstrateOptions = {}): DomSubstrate {
  return {
    id: 'dom',
    variants: [THEME_AXIS, VIEWPORT_AXIS],

    render(tree: ReactNode, ctx: SubstrateRenderContext): DomFrame {
      // A component declared `browserOnly` opts out of server rendering: skip
      // the attempt (no throw, no log) and let the client mount it.
      if (ctx.clientOnly) return { html: '', browserOnly: true, headStyles: '' }
      try {
        // Apply any configured style engines around the case tree so render-time
        // CSS-in-JS styling (emotion/MUI, styled-components…) is collected and
        // delivered before scripting.
        const { html, headStyles } = renderWithStyles(
          tree,
          ctx.config.styleEngines,
        )
        return { html, browserOnly: false, headStyles }
      } catch (err) {
        // The case — or a component it renders — needs a browser: it touched a
        // browser-only API (window, layout measurement, canvas…) under
        // `renderToString`. Don't fail the document; emit no server markup and
        // let the client mount it. The caller records it so later requests skip
        // the server attempt and the author gets one log line.
        return {
          html: '',
          browserOnly: true,
          headStyles: '',
          error: err instanceof Error ? err.message : String(err),
        }
      }
    },

    serialize(frame: DomFrame): SerializedFrame {
      return { bytes: new TextEncoder().encode(frame.html), ext: 'html' }
    },

    document: domDocument,

    stage: {
      // The DOM mount: adopts the delivered markup (or mounts fresh for a
      // client-only case) and then drives in-place swaps, tweaks, and flow
      // steps. Resolved to an absolute path so the codegen'd per-component
      // entry can import it from the build cache, wherever that sits.
      entry: resolve(import.meta.dir, '..', 'ui', 'render-mount.tsx'),
    },

    // React is the DOM substrate's rendering runtime, so it is always delivered
    // once across a published build. Declaring it here rather than hard-coding
    // it in the bundler means a substrate whose stage is not React-based is not
    // forced to carry it.
    alwaysShare: ['react', 'react-dom', 'react-dom/client'],

    checks: {
      /**
       * One painted browser page per variant, shared by the visual and
       * accessibility phases.
       *
       * Both must see the same paint — a screenshot and an axe run that
       * disagreed about which render they described would make a finding
       * unattributable — and opening a page each would double the browser work
       * for a run that asks for both, which is the usual CI shape.
       *
       * The driver is resolved by the caller and handed in, so the lazily
       * loaded Playwright/axe toolchain stays out of this module's graph.
       */
      async openVariant(ctx) {
        const driver = ctx.driver
        if (!driver) {
          throw new Error(
            'The DOM substrate needs a render driver to capture and audit. ' +
              'Install the default toolchain, or supply one with ' +
              'domSubstrate({ driver }).',
          )
        }
        if (!ctx.renderUrl) {
          throw new Error(
            'The DOM substrate captures by painting a served document, so it ' +
              'needs the case‘s render address.',
          )
        }
        const page = await driver.open(ctx.renderUrl, ctx.case)
        return {
          // A painted screenshot, not this substrate's serialized document:
          // a visual regression is about what the case *looks* like.
          ext: 'png',
          capture: () => page.screenshot(),
          audit: (opts) => page.audit(opts),
          dispose: () => page.dispose(),
        }
      },

      /**
       * Design-token conformance for this medium: CSS custom properties.
       *
       * Imported lazily so the token checker — and the file-walking it does —
       * is only loaded when the phase actually runs, matching how the rest of
       * the optional check toolchain is loaded. A substrate for another medium
       * has an entirely different style vocabulary (or none), which is why this
       * belongs to the substrate rather than to the check runner.
       */
      async tokens(ctx) {
        // The specifier is assembled at runtime so the bundler cannot follow it.
        // This module is reachable from a *consumer's config* (a showcase that
        // writes `substrate: domSubstrate(...)`), and that config is bundled for
        // the **browser** to build each case. A statically-visible import would
        // drag the token checker — and its `import { Glob } from 'bun'` — into
        // that browser graph and fail the build outright. The check phases only
        // ever run under Bun, so deferring resolution to call time is correct,
        // not a trick.
        const specifier = ['..', 'checks', 'tokens-check'].join('/')
        const { checkTokens } = (await import(
          specifier
        )) as typeof import('../checks/tokens-check')
        // `checkTokens` reads the showcase's `tokens.allow` from its own config
        // resolution, so the allow-list on the context is already honored.
        const { violations } = await checkTokens(ctx.pkgDir)
        return violations.map((v) => ({
          componentId: '',
          sourcePath: v.file,
          severity: 'error' as const,
          message: `${relativeTo(ctx.pkgDir, v.file)}:${v.line}:${v.column} unknown token ${v.token}${
            v.hadFallback ? ' (fallback does not excuse it)' : ''
          }`,
        }))
      },
    },

    // Capture needs a real browser paint, so this substrate captures through the
    // driver rather than the contract's headless `serialize(render(...))`
    // default: a screenshot of an unpainted document is not the case's
    // appearance. The check phases are wired to it in a later step; the driver
    // it uses is carried here.
    driver: opts.driver,
  }
}

/** Package-relative path for a finding, so output stays navigable. */
function relativeTo(pkgDir: string, file: string): string {
  return file.startsWith(`${pkgDir}/`) ? file.slice(pkgDir.length + 1) : file
}
