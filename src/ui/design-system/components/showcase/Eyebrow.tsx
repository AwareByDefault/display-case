import type { HTMLAttributes, ReactNode } from 'react'

/**
 * Display Case — Eyebrow
 * The signature label: uppercase JetBrains Mono, wide tracking, muted. Marks
 * every section in the chrome (group headers, panel titles, "Tweaks",
 * "Documentation").
 */

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
