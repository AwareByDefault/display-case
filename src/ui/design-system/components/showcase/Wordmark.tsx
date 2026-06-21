import type { HTMLAttributes, ReactNode } from 'react'

/**
 * Display Case — Wordmark
 * The bracketed wordmark. The text wraps *inside* a pair of marigold brackets
 * drawn with borders (not glyphs) as flex items pinned to the ends, so they stay
 * put instead of wrapping with the text and stretch vertically to the full text
 * height — one line or many. Scales with `font-size` (everything is em-based).
 * Display Case's own title and the charm of the identity — never decoration.
 */

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
