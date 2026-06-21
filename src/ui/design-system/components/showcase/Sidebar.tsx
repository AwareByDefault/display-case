import type { HTMLAttributes, ReactNode } from 'react'
import { injectStyle } from '../inject-style'

/**
 * Display Case — Sidebar
 * The nav rail: a scrolling, hairline-bordered column on the subtle backdrop
 * that holds the component tree. It's the ground NavItem rows are designed to
 * sit on — the rows are transparent and only read correctly against this
 * `--dc-bg-subtle` surface. Layout (grid placement, collapse) is the chrome's;
 * the surface is the component's.
 */

const CSS = `
.dcui-sidebar {
  overflow-y: auto;
  padding: var(--dc-space-6);
  border-right: var(--dc-border-line);
  background: var(--dc-bg-subtle);
}
`
injectStyle('dcui-sidebar', CSS)

export interface SidebarProps extends HTMLAttributes<HTMLElement> {
  /** Accessible name for the nav landmark; consumers should pass the contextual
   *  name (the chrome uses "Components"). Defaults to a generic fallback so the
   *  landmark always has an accessible name. */
  label?: string
  children?: ReactNode
}

export function Sidebar({
  label = 'Navigation',
  children,
  ...rest
}: SidebarProps) {
  return (
    <nav className="dcui-sidebar" aria-label={label} {...rest}>
      {children}
    </nav>
  )
}
