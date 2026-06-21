import type { ButtonHTMLAttributes, ReactNode } from 'react'

/**
 * Display Case — Button
 * The quiet, bordered control the chrome leans on. `ghost` is the default (it
 * recedes); `primary` (warm ink) and `accent` (marigold) are for the rare
 * emphatic action; `subtle` is borderless. A toggle button lights marigold via
 * `aria-pressed`.
 *
 * Styling lives in the sibling `Button.css`, concatenated into the Vitrine
 * stylesheet and inlined into every document head server-side (see
 * `readVitrineCss` in server.ts) — no runtime injection.
 */

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
