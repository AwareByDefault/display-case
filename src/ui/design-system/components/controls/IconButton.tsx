import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { injectStyle } from '../inject-style'

/**
 * Display Case — IconButton
 * A square control carrying a single Unicode glyph (☰ ⟲ ✕ ＋ −). Display Case
 * uses no icon font and no SVG icons — just glyphs. `bare` drops the border;
 * `active` / `aria-pressed` light it marigold.
 */

const CSS = `
.dcui-iconbtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  font-family: var(--dc-font-mono);
  font-size: var(--dc-text-md);
  line-height: 1;
  color: var(--dc-fg);
  background: var(--dc-surface);
  border: 1px solid var(--dc-border);
  border-radius: var(--dc-radius-sm);
  cursor: pointer;
  transition: background var(--dc-transition-fast),
    color var(--dc-transition-fast), border-color var(--dc-transition-fast),
    transform var(--dc-transition-fast);
}
.dcui-iconbtn:hover { background: var(--dc-hover); }
.dcui-iconbtn:active { background: var(--dc-active); transform: translateY(0.5px); }
.dcui-iconbtn:focus-visible { outline: 2px solid var(--dc-focus-ring); outline-offset: 1px; }
.dcui-iconbtn[data-size="sm"] { width: 26px; height: 26px; font-size: var(--dc-text-base); }
.dcui-iconbtn[data-size="lg"] { width: 36px; height: 36px; font-size: var(--dc-text-lg); }
.dcui-iconbtn[aria-pressed="true"],
.dcui-iconbtn[data-active="true"] {
  color: var(--dc-brand);
  border-color: var(--dc-brand);
  background: var(--dc-brand-subtle);
}
.dcui-iconbtn[data-variant="bare"] { border-color: transparent; background: transparent; color: var(--dc-fg-muted); }
.dcui-iconbtn[data-variant="bare"]:hover { background: var(--dc-hover); color: var(--dc-fg); }
.dcui-iconbtn:disabled { opacity: 0.45; cursor: not-allowed; }
.dcui-iconbtn:disabled:hover { background: var(--dc-surface); transform: none; }
.dcui-iconbtn[data-variant="bare"]:disabled:hover { background: transparent; }
`
injectStyle('dcui-iconbutton', CSS)

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
