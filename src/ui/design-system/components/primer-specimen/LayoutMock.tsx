import type { ReactNode } from 'react'
import './styles'

/**
 * Display Case — LayoutMock
 * A miniature three-region wireframe — header over a sidebar + main split.
 * Generic specimen primitive for a Primer — use it to sketch an app's shell
 * layout without committing to real chrome. Each region accepts any label or
 * node; omit a region to leave it empty.
 */

export interface LayoutMockProps {
  header?: ReactNode
  sidebar?: ReactNode
  main?: ReactNode
  /** Width of the sidebar region (any CSS length). */
  sidebarWidth?: string
}

export function LayoutMock({
  header = 'header',
  sidebar = 'sidebar',
  main = 'main',
  sidebarWidth = '32%',
}: LayoutMockProps) {
  return (
    <div className="dcpl-layout">
      <div className="dcpl-layout-head">{header}</div>
      <div className="dcpl-layout-body">
        <div className="dcpl-layout-side" style={{ width: sidebarWidth }}>
          {sidebar}
        </div>
        <div className="dcpl-layout-main">{main}</div>
      </div>
    </div>
  )
}
