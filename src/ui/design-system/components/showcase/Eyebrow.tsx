import type { HTMLAttributes, ReactNode } from 'react'
import { injectStyle } from '../inject-style'

/**
 * Display Case — Eyebrow
 * The signature label: uppercase JetBrains Mono, wide tracking, muted. Marks
 * every section in the chrome (group headers, panel titles, "Tweaks",
 * "Documentation").
 */

const CSS = `
.dcui-eyebrow {
  font-family: var(--dc-font-mono);
  font-size: var(--dc-text-xs);
  font-weight: var(--dc-weight-medium);
  letter-spacing: var(--dc-tracking-label);
  text-transform: uppercase;
  color: var(--dc-fg-muted);
  line-height: var(--dc-leading-tight);
  margin: 0;
}
.dcui-eyebrow[data-tone="accent"] { color: var(--dc-brand); }
.dcui-eyebrow[data-tone="strong"] { color: var(--dc-fg); }
`
injectStyle('dcui-eyebrow', CSS)

export type EyebrowTone = 'muted' | 'accent' | 'strong'

export interface EyebrowProps extends HTMLAttributes<HTMLElement> {
  as?: 'div' | 'span' | 'p'
  tone?: EyebrowTone
  children?: ReactNode
}

export function Eyebrow({
  as: Tag = 'div',
  tone = 'muted',
  children,
  ...rest
}: EyebrowProps) {
  return (
    <Tag className="dcui-eyebrow" data-tone={tone} {...rest}>
      {children}
    </Tag>
  )
}
