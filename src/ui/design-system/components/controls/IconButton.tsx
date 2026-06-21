import type { ButtonHTMLAttributes, ReactNode } from 'react'

/**
 * Display Case — IconButton
 * A square control carrying a single Unicode glyph (☰ ⟲ ✕ ＋ −). Display Case
 * uses no icon font and no SVG icons — just glyphs. `bare` drops the border;
 * `active` / `aria-pressed` light it marigold.
 */

export type IconButtonSize = 'sm' | 'md' | 'lg'
export type IconButtonVariant = 'outline' | 'bare'

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  /** The glyph to render (alternatively pass `children`). */
  glyph?: ReactNode
  size?: IconButtonSize
  variant?: IconButtonVariant
  /** Persistent "on" state (marigold), for non-toggle emphasis. */
  active?: boolean
  /** Accessible name — required since the button is glyph-only. */
  label: string
}

export function IconButton({
  glyph,
  size = 'md',
  variant = 'outline',
  active = false,
  type = 'button',
  label,
  children,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      className="dcui-iconbtn"
      data-size={size}
      data-variant={variant}
      data-active={active ? 'true' : undefined}
      aria-label={label}
      {...rest}>
      {glyph ?? children}
    </button>
  )
}
