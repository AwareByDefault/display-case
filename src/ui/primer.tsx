import type { ReactNode } from 'react'
import { useCallback, useEffect, useRef } from 'react'
import { slugify } from '../core/catalog'

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
    // The `!els.length` guard above ensures els is non-empty, so first/last exist.
    let active = els[0]?.id ?? ''
    if (atBottom) {
      active = els[els.length - 1]?.id ?? active
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
