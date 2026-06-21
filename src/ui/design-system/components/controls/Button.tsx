import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { injectStyle } from '../inject-style'

/**
 * Display Case — Button
 * The quiet, bordered control the chrome leans on. `ghost` is the default (it
 * recedes); `primary` (warm ink) and `accent` (marigold) are for the rare
 * emphatic action; `subtle` is borderless. A toggle button lights marigold via
 * `aria-pressed`.
 */

const CSS = `
.dcui-btn {
  --_bg: var(--dc-surface);
  --_fg: var(--dc-fg);
  --_bd: var(--dc-border);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--dc-space-2);
  font-family: var(--dc-font-sans);
  font-size: var(--dc-text-base);
  font-weight: var(--dc-weight-medium);
  line-height: 1;
  color: var(--_fg);
  background: var(--_bg);
  border: 1px solid var(--_bd);
  border-radius: var(--dc-radius-sm);
  padding: 0 var(--dc-space-6);
  height: 30px;
  cursor: pointer;
  white-space: nowrap;
  transition: background var(--dc-transition-fast),
    border-color var(--dc-transition-fast), color var(--dc-transition-fast),
    transform var(--dc-transition-fast);
}
.dcui-btn:hover { background: var(--dc-hover); }
.dcui-btn:active { transform: translateY(0.5px); }
.dcui-btn:focus-visible { outline: 2px solid var(--dc-focus-ring); outline-offset: 1px; }
.dcui-btn[data-size="sm"] { height: 26px; font-size: var(--dc-text-sm); padding: 0 var(--dc-space-4); }
.dcui-btn[data-size="lg"] { height: 36px; padding: 0 var(--dc-space-8); }

.dcui-btn[data-variant="primary"] {
  --_bg: var(--dc-ink); --_fg: var(--dc-ink-fg); --_bd: var(--dc-ink);
}
.dcui-btn[data-variant="primary"]:hover { background: var(--dc-ink-hover); border-color: var(--dc-ink-hover); }
.dcui-btn[data-variant="accent"] {
  --_bg: var(--dc-brand); --_fg: var(--dc-brand-fg); --_bd: var(--dc-brand);
}
.dcui-btn[data-variant="accent"]:hover { background: var(--dc-brand-hover); border-color: var(--dc-brand-hover); }
.dcui-btn[data-variant="subtle"] {
  --_bg: transparent; --_bd: transparent; --_fg: var(--dc-fg-muted);
}
.dcui-btn[data-variant="subtle"]:hover { background: var(--dc-hover); color: var(--dc-fg); }

/* Toggle "on" — marigold (the active selection colour). */
.dcui-btn[aria-pressed="true"] {
  --_fg: var(--dc-brand); --_bd: var(--dc-brand); --_bg: var(--dc-brand-subtle);
}

.dcui-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.dcui-btn:disabled:hover { background: var(--_bg); transform: none; }
`
injectStyle('dcui-button', CSS)

export type ButtonVariant = 'ghost' | 'primary' | 'accent' | 'subtle'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  children?: ReactNode
}

export function Button({
  variant = 'ghost',
  size = 'md',
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className="dcui-btn"
      data-variant={variant}
      data-size={size}
      {...rest}>
      {children}
    </button>
  )
}
