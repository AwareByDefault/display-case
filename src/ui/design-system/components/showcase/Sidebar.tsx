import type {
  HTMLAttributes,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
  PointerEvent as ReactPointerEvent,
} from 'react'

/**
 * Display Case — Sidebar
 * The nav rail: a scrolling, hairline-bordered column on the subtle backdrop
 * that holds the component tree. It's the ground NavItem rows are designed to
 * sit on — the rows are transparent and only read correctly against this
 * `--dc-bg-subtle` surface. Layout (grid placement, collapse) is the chrome's;
 * the surface is the component's.
 *
 * Pass `resize` to render a draggable handle on the rail's right edge. The
 * Sidebar owns only the handle (markup, a11y, the brand-on-hover affordance);
 * the consumer owns the width and the drag/keyboard math, so the same handle
 * drives the live chrome (width persisted to storage) or a self-contained
 * exhibit (local state).
 */

export interface SidebarResize {
  /** Begin a drag-resize (pointer down on the handle). */
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void
  /** Keyboard resize (arrow keys while the handle is focused). */
  onKeyDown: (e: ReactKeyboardEvent<HTMLDivElement>) => void
  /** Current / min / max width, for the separator's ARIA value. */
  valueNow: number
  valueMin: number
  valueMax: number
  /** `data-testid` for the handle. */
  testId?: string
}

export interface SidebarProps extends HTMLAttributes<HTMLElement> {
  /** Accessible name for the nav landmark; consumers should pass the contextual
   *  name (the chrome uses "Components"). Defaults to a generic fallback so the
   *  landmark always has an accessible name. */
  label?: string
  /** When set, renders a draggable resize handle on the rail's right edge. */
  resize?: SidebarResize
  children?: ReactNode
}

export function Sidebar({
  label = 'Navigation',
  resize,
  children,
  ...rest
}: SidebarProps) {
  return (
    <nav className="dcui-sidebar" aria-label={label} {...rest}>
      {children}
      {resize ? (
        // biome-ignore lint/a11y/useSemanticElements: a draggable splitter, not a thematic break
        <div
          className="dcui-sidebar-resize"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          aria-valuenow={resize.valueNow}
          aria-valuemin={resize.valueMin}
          aria-valuemax={resize.valueMax}
          tabIndex={0}
          data-testid={resize.testId}
          onPointerDown={resize.onPointerDown}
          onKeyDown={resize.onKeyDown}
        />
      ) : null}
    </nav>
  )
}
