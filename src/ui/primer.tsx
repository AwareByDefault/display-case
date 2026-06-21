import type { ReactNode } from 'react'
import { useCallback, useEffect, useRef } from 'react'
import { slugify } from '../core/catalog'
import { injectStyle } from './design-system/components/inject-style'

/**
 * The Primer — Display Case's long-form "wall text". A consumer authors an
 * `.mdx` document (referenced from `display-case.config.ts`), and it renders
 * here as a scrolling reading page with embedded LIVE specimens. The MDX can
 * import any component — case files *and* arbitrary `.tsx` — and wraps each
 * specimen in the {@link Display} contract below.
 *
 * This module is bundled into the isolated `/render/primer` document (never the browse
 * chrome), so a specimen that throws on load can't blank the chrome — the same
 * isolation the `/render` frame gives a case. It talks to the chrome over
 * `postMessage`: it reports its section list (for the sidebar table of contents)
 * and the active section on scroll, and accepts scroll-to / theme messages back.
 */

const CSS = `
.dc-primer {
  height: 100vh;
  overflow-y: auto;
  background: var(--dc-bg);
  color: var(--dc-fg);
  font-family: var(--dc-font-sans);
  font-size: var(--dc-text-base);
  line-height: var(--dc-leading-relaxed);
}
.dc-primer-inner {
  max-width: 56rem;
  margin: 0 auto;
  padding: var(--dc-space-16) var(--dc-space-12) 6rem;
}

/* Prose — quiet, legible long-form copy. */
.dc-primer h1 {
  font-size: var(--dc-text-2xl);
  font-weight: var(--dc-weight-bold);
  letter-spacing: var(--dc-tracking-tight);
  line-height: var(--dc-leading-tight);
  margin: 0 0 var(--dc-space-8);
}
.dc-primer h2 {
  font-size: var(--dc-text-xl);
  font-weight: var(--dc-weight-semibold);
  letter-spacing: var(--dc-tracking-tight);
  line-height: var(--dc-leading-tight);
  margin: 3rem 0 var(--dc-space-8);
  scroll-margin-top: var(--dc-space-8);
}
.dc-primer h3 {
  font-size: var(--dc-text-lg);
  font-weight: var(--dc-weight-semibold);
  margin: var(--dc-space-12) 0 var(--dc-space-4);
}
.dc-primer p {
  margin: 0 0 var(--dc-space-8);
  color: var(--dc-fg);
}
.dc-primer a {
  color: var(--dc-brand);
  text-decoration: none;
}
.dc-primer a:hover { text-decoration: underline; }
.dc-primer strong { font-weight: var(--dc-weight-semibold); }
.dc-primer ul,
.dc-primer ol {
  margin: 0 0 var(--dc-space-8);
  padding-left: var(--dc-space-12);
}
.dc-primer li { margin: var(--dc-space-2) 0; }
.dc-primer code {
  font-family: var(--dc-font-mono);
  font-size: 0.9em;
  background: var(--dc-bg-subtle);
  border: var(--dc-border-line);
  border-radius: var(--dc-radius-sm);
  padding: 0.05em 0.35em;
}
.dc-primer pre {
  font-family: var(--dc-font-mono);
  font-size: var(--dc-text-sm);
  line-height: var(--dc-leading-normal);
  background: var(--dc-bg-subtle);
  border: var(--dc-border-line);
  border-radius: var(--dc-radius-md);
  padding: var(--dc-space-8);
  overflow-x: auto;
  margin: 0 0 var(--dc-space-8);
}
.dc-primer pre code {
  background: none;
  border: 0;
  padding: 0;
}

/* Tables (GFM) — border-led and flat, like every other Vitrine surface: a
   hairline frame, a quiet mono header on the subtle fill, and hairline row
   rules. Authored as Markdown pipe-tables; this gives them the chrome's look
   without per-document styling. */
.dc-primer table {
  width: 100%;
  border-collapse: collapse;
  margin: 0 0 var(--dc-space-8);
  font-size: var(--dc-text-sm);
  border: var(--dc-border-line);
}
.dc-primer thead th {
  text-align: left;
  padding: var(--dc-space-5) var(--dc-space-6);
  background: var(--dc-bg-subtle);
  color: var(--dc-fg-muted);
  font-family: var(--dc-font-mono);
  font-size: var(--dc-text-2xs);
  font-weight: var(--dc-weight-medium);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: var(--dc-border-line);
}
.dc-primer tbody td {
  padding: var(--dc-space-5) var(--dc-space-6);
  vertical-align: top;
  color: var(--dc-fg);
}
.dc-primer tbody tr + tr td { border-top: var(--dc-border-line); }

/* Display — the specimen card contract. The title and subtitle sit as plain
   wall-text *above* the box; the box holds only the live specimen. */
.dc-display {
  margin: 0 0 var(--dc-space-12);
  scroll-margin-top: var(--dc-space-8);
}
.dc-display-head {
  margin-bottom: var(--dc-space-5);
}
.dc-display-title {
  font-size: var(--dc-text-lg);
  font-weight: var(--dc-weight-semibold);
  letter-spacing: var(--dc-tracking-tight);
  line-height: var(--dc-leading-tight);
  color: var(--dc-fg);
}
.dc-display-sub {
  margin-top: var(--dc-space-1);
  font-size: var(--dc-text-sm);
  color: var(--dc-fg-muted);
}
.dc-display-specimen {
  border: var(--dc-border-line);
  border-radius: var(--dc-radius-md);
  background: var(--dc-bg);
  padding: var(--dc-space-12);
  display: flex;
  flex-wrap: wrap;
  gap: var(--dc-space-8);
  align-items: center;
  justify-content: center;
}
/* A forced-theme specimen re-scopes the design tokens for its subtree, so it
   must repaint its own surface (the value the consumer app would give it). */
.dc-display-specimen[data-theme] {
  background: var(--dc-bg);
  color: var(--dc-fg);
}
/* App surface — opt in (appSurface) to paint the consumer design system's own
   canvas (--color-bg/--color-fg, the same tokens the /render frame paints)
   instead of the Vitrine's --dc-bg, so a specimen sits on the exact background
   the real app gives it. Degrades to --dc-bg when the consumer defines no
   --color-bg. Listed after the [data-theme] rule (equal specificity → source
   order wins), and the [data-theme] combination is spelled out so a forced-theme
   app-surface specimen resolves the themed --color-bg of its own subtree. */
.dc-display-specimen[data-app-surface],
.dc-display-specimen[data-app-surface][data-theme] {
  background: var(--color-bg, var(--dc-bg));
  color: var(--color-fg, var(--dc-fg));
}
/* Flush — the specimen draws no frame or padding of its own. A single
   self-bordered child (e.g. a DefinitionList) fills the box edge-to-edge and
   supplies the one border, so there's no box-within-a-box; the rounded, clipped
   background still backs the child's corners. */
.dc-display-specimen[data-flush] {
  display: block;
  padding: 0;
  border: 0;
  overflow: hidden;
}
`
injectStyle('dc-primer', CSS)

export interface DisplayProps {
  /** Specimen title — also the sidebar table-of-contents label and scroll anchor. */
  title: string
  /** Optional one-line description shown under the title. */
  subtitle?: string
  /** Force a theme inside this specimen (e.g. show a dark-mode component on a
   *  light primer). Omit to inherit the primer's current theme. */
  theme?: 'light' | 'dark'
  /** Drop the specimen's own border and padding so a single self-bordered child
   *  (e.g. a DefinitionList) fills the box edge-to-edge — avoids a
   *  box-within-a-box. The child supplies the border; this frame just clips it. */
  flush?: boolean
  /** Paint the specimen box with the consumer design system's own canvas
   *  (`--color-bg`/`--color-fg`) instead of the Vitrine's `--dc-bg`, so the
   *  component sits on the exact background the real app gives it. Opt-in;
   *  degrades to `--dc-bg` when the consumer defines no `--color-bg`. Combine
   *  with `theme` to show the app's themed surface. */
  appSurface?: boolean
  children?: ReactNode
}

/**
 * The contract an `.mdx` primer wraps each live specimen in. Renders a titled
 * card; the body is a flex row the specimen lays out in. `theme` forces a
 * light/dark scope local to the card.
 *
 * @example
 * <Display title="Button" subtitle="The quiet bordered control" theme="dark">
 *   <Button variant="accent">Snapshot</Button>
 * </Display>
 */
export function Display({
  title,
  subtitle,
  theme,
  flush,
  appSurface,
  children,
}: DisplayProps) {
  return (
    <section
      className="dc-display"
      id={`section-${slugify(title)}`}
      data-dc-section=""
      data-dc-title={title}>
      <div className="dc-display-head">
        <div className="dc-display-title">{title}</div>
        {subtitle ? <div className="dc-display-sub">{subtitle}</div> : null}
      </div>
      <div
        className="dc-display-specimen"
        data-theme={theme}
        data-flush={flush ? '' : undefined}
        data-app-surface={appSurface ? '' : undefined}>
        {children}
      </div>
    </section>
  )
}

interface PrimerSection {
  id: string
  title: string
  /** `heading` is a `##` group header; `display` is a specimen card under it. */
  kind: 'heading' | 'display'
}

/** Flatten a React node tree to its text content (for a heading's slug + label). */
function textOf(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (typeof node === 'object' && 'props' in node)
    return textOf(
      (node as { props?: { children?: ReactNode } }).props?.children,
    )
  return ''
}

/**
 * The `#`/`##` headings in a primer MDX. Beyond rendering the prose heading,
 * each becomes a navigable group header in the sidebar table of contents: the
 * Displays that follow it nest under it (see {@link PrimerRoot} reporting). The
 * H1 thus doubles as the "top of page" entry, with its intro specimens nested.
 */
function PrimerHeading({
  tag: Tag,
  children,
}: {
  tag: 'h1' | 'h2'
  children?: ReactNode
}) {
  const text = textOf(children)
  return (
    <Tag
      id={`heading-${slugify(text)}`}
      data-dc-heading=""
      data-dc-title={text}>
      {children}
    </Tag>
  )
}

/** Components map handed to the compiled MDX — resolves `<Display>` and `#`/`##`. */
export const primerComponents = {
  Display,
  h1: ({ children }: { children?: ReactNode }) => (
    <PrimerHeading tag="h1">{children}</PrimerHeading>
  ),
  h2: ({ children }: { children?: ReactNode }) => (
    <PrimerHeading tag="h2">{children}</PrimerHeading>
  ),
}

/**
 * The scrolling reading page. Renders the compiled MDX document and wires the
 * scrollspy ↔ chrome messaging: it reports the section list and the active
 * section, and reacts to scroll-to / theme messages from the parent chrome.
 */
export function PrimerRoot({
  content,
}: {
  content: (props: { components?: unknown }) => ReactNode
}) {
  // Capitalize for JSX use (the compiled MDX document is a component).
  const Content = content
  const scrollRef = useRef<HTMLDivElement | null>(null)
  // During a click-driven smooth scroll, the highlight is locked to the target
  // and scrollspy is paused — otherwise the active row flickers across every
  // section the scroll passes over (many hidden inside collapsed nav groups).
  const programmatic = useRef(false)
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const embedded = typeof window !== 'undefined' && window.parent !== window

  const post = useCallback(
    (message: unknown) => {
      if (embedded) window.parent.postMessage(message, '*')
    },
    [embedded],
  )

  // Both `##` headings and Displays anchor the table of contents; in document
  // order they let the chrome nest each Display under its heading.
  const sectionEls = useCallback((): HTMLElement[] => {
    const root = scrollRef.current
    if (!root) return []
    return Array.from(
      root.querySelectorAll<HTMLElement>(
        '[data-dc-section], [data-dc-heading]',
      ),
    )
  }, [])

  const reportSections = useCallback(() => {
    const sections: PrimerSection[] = sectionEls().map((el) => ({
      id: el.id,
      title: el.dataset.dcTitle ?? el.id,
      kind: el.hasAttribute('data-dc-heading') ? 'heading' : 'display',
    }))
    post({ type: 'dc-primer-sections', sections })
  }, [post, sectionEls])

  const reportActive = useCallback(() => {
    const root = scrollRef.current
    if (!root) return
    const els = sectionEls()
    if (!els.length) return
    // At (or near) the bottom the last section can't scroll to the top, so the
    // "topmost past the line" rule would never reach it — pin it active there.
    const atBottom = root.scrollTop + root.clientHeight >= root.scrollHeight - 4
    let active = els[0].id
    if (atBottom) {
      active = els[els.length - 1].id
    } else {
      const top = root.getBoundingClientRect().top
      for (const el of els) {
        if (el.getBoundingClientRect().top - top <= 80) active = el.id
      }
    }
    post({ type: 'dc-primer-active', id: active })
  }, [post, sectionEls])

  // Resume scrollspy once a programmatic scroll has settled (no scroll events
  // for a beat) and re-sync the active section to where it actually landed. Also
  // covers the no-op case where the target is already at the top, so nothing
  // ever scrolls and `onScroll` never fires to release the lock.
  const armSettle = useCallback(() => {
    if (settleTimer.current) clearTimeout(settleTimer.current)
    settleTimer.current = setTimeout(() => {
      programmatic.current = false
      reportActive()
    }, 150)
  }, [reportActive])

  // Report the section list once mounted (and whenever the content resizes, e.g.
  // late fonts/images shifting offsets), and keep the active section current.
  useEffect(() => {
    const root = scrollRef.current
    if (!root) return
    reportSections()
    reportActive()
    post({ type: 'dc-primer-ready' })
    const onScroll = () => {
      // While a click-driven scroll animates, hold the highlight on the target
      // and just keep pushing the settle deadline out until the motion stops.
      if (programmatic.current) {
        armSettle()
        return
      }
      reportActive()
    }
    root.addEventListener('scroll', onScroll, { passive: true })
    const ro = new ResizeObserver(() => {
      reportSections()
      reportActive()
    })
    ro.observe(root)
    return () => {
      root.removeEventListener('scroll', onScroll)
      ro.disconnect()
      if (settleTimer.current) clearTimeout(settleTimer.current)
    }
  }, [reportSections, reportActive, armSettle, post])

  // Accept scroll-to (sidebar TOC click) and theme messages from the chrome.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== window.parent) return
      const data = e.data as { type?: string; id?: string; theme?: string }
      if (data?.type === 'dc-primer-scroll' && data.id) {
        // Section ids are slug-safe (`section-<kebab>`), so id lookup needs no
        // escaping — and the local `CSS` here is the style string, not the global.
        const el = document.getElementById(data.id)
        if (el) {
          // Lock the highlight to the clicked target and pause scrollspy until
          // the smooth scroll settles, so it doesn't crawl across intermediate
          // (often hidden) sections on the way there.
          programmatic.current = true
          post({ type: 'dc-primer-active', id: data.id })
          el.scrollIntoView({ behavior: 'smooth', block: 'start' })
          armSettle()
        }
      } else if (data?.type === 'dc-primer-theme' && data.theme) {
        document.documentElement.dataset.theme = data.theme
        document.documentElement.dataset.themePref = data.theme
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [post, armSettle])

  return (
    <div className="dc-primer" ref={scrollRef}>
      <div className="dc-primer-inner">
        <Content components={primerComponents} />
      </div>
    </div>
  )
}
