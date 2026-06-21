import type { ReactNode } from 'react'
import { injectStyle } from '../inject-style'

/**
 * Display Case — Chip
 * A small pill for hierarchy levels (atom, molecule…), flow steps, tweak
 * tokens, and counts. Static by default; pass `onClick` and it becomes a button
 * (used for flow-step selection).
 */

const CSS = `
.dcui-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--dc-space-2);
  font-family: var(--dc-font-mono);
  font-size: var(--dc-text-xs);
  font-weight: var(--dc-weight-medium);
  line-height: 1;
  color: var(--dc-fg-muted);
  background: var(--dc-bg-subtle);
  border: 1px solid var(--dc-border);
  border-radius: var(--dc-radius-full);
  padding: 0.3125rem var(--dc-space-4);
  white-space: nowrap;
}
button.dcui-chip { cursor: pointer; transition: border-color var(--dc-transition-fast), color var(--dc-transition-fast), background var(--dc-transition-fast); }
button.dcui-chip:hover { color: var(--dc-fg); border-color: var(--dc-border-strong); }
button.dcui-chip:focus-visible { outline: 2px solid var(--dc-focus-ring); outline-offset: 1px; }
.dcui-chip[data-variant="accent"] {
  color: var(--dc-brand); background: var(--dc-brand-subtle); border-color: var(--dc-brand);
}
.dcui-chip[data-variant="solid"] {
  color: var(--dc-ink-fg); background: var(--dc-ink); border-color: var(--dc-ink);
}
.dcui-chip[aria-current="true"] {
  color: var(--dc-brand); border-color: var(--dc-brand); background: var(--dc-brand-subtle);
}
.dcui-chip-index { color: var(--dc-fg-subtle); }
.dcui-chip[aria-current="true"] .dcui-chip-index { color: var(--dc-brand); }
`
injectStyle('dcui-chip', CSS)

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
