import type { HTMLAttributes, ReactNode } from 'react'
import { injectStyle } from '../inject-style'

/**
 * Display Case — Wordmark
 * The bracketed wordmark. The text wraps *inside* a pair of marigold brackets
 * drawn with borders (not glyphs) as flex items pinned to the ends, so they stay
 * put instead of wrapping with the text and stretch vertically to the full text
 * height — one line or many. Scales with `font-size` (everything is em-based).
 * Display Case's own title and the charm of the identity — never decoration.
 */

const CSS = `
.dcui-wordmark {
  display: inline-flex;
  align-items: stretch;
  gap: 0.4em;
  font-weight: var(--dc-weight-semibold);
  letter-spacing: var(--dc-tracking-tight);
  line-height: 1.25;
  min-width: 0;
}
.dcui-wordmark-text {
  min-width: 0;
  overflow-wrap: break-word;
  text-align: center;
}
.dcui-wordmark::before,
.dcui-wordmark::after {
  content: "";
  flex: 0 0 auto;
  align-self: stretch;
  width: 0.3em;
  /* Stroke scales sub-linearly with the text: the em term lets it thicken gently
     as the text grows (not 1:1 with font-size, which gets heavy at large sizes),
     while the 2px floor keeps it from ever going thinner than the base hairline. */
  border: max(2px, calc(1.25px + 0.05em)) solid var(--dc-brand);
}
.dcui-wordmark::before {
  border-right: 0;
}
.dcui-wordmark::after {
  border-left: 0;
}
`
injectStyle('dcui-wordmark', CSS)

export interface WordmarkProps extends HTMLAttributes<HTMLElement> {
  children?: ReactNode
}

export function Wordmark({ children, ...rest }: WordmarkProps) {
  return (
    <span className="dcui-wordmark" {...rest}>
      <span className="dcui-wordmark-text">{children}</span>
    </span>
  )
}
