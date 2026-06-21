import type { ReactNode } from 'react'

/**
 * Display Case — Chip
 * A small pill for hierarchy levels (atom, molecule…), flow steps, tweak
 * tokens, and counts. Static by default; pass `onClick` and it becomes a button
 * (used for flow-step selection).
 */

export type ChipVariant = 'default' | 'accent' | 'solid'

export interface ChipProps {
  variant?: ChipVariant
  current?: boolean
  /** Leading index/number (mono, dimmed) — used by flow-step chips. */
  index?: ReactNode
  /** When set, the chip renders as a button. */
  onClick?: () => void
  label?: string
  children?: ReactNode
}

export function Chip({
  variant = 'default',
  current = false,
  index,
  onClick,
  label,
  children,
}: ChipProps) {
  const inner = (
    <>
      {index != null ? <span className="dcui-chip-index">{index}</span> : null}
      {children}
    </>
  )
  const common = {
    className: 'dcui-chip',
    'data-variant': variant,
    'aria-current': current ? ('true' as const) : undefined,
  }
  if (onClick) {
    return (
      <button type="button" {...common} aria-label={label} onClick={onClick}>
        {inner}
      </button>
    )
  }
  return (
    <span {...common} title={label}>
      {inner}
    </span>
  )
}
