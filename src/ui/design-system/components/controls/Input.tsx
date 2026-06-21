import type { CSSProperties, InputHTMLAttributes, ReactNode } from 'react'
import { injectStyle } from '../inject-style'

/**
 * Display Case — Input
 * Text / number field. Supports a leading label slot and a trailing unit suffix
 * (used by the device-dimension fields: 1280 × 800). The border + marigold
 * focus ring live on the wrapper so prefix/suffix sit inside the field.
 */

const CSS = `
.dcui-field {
  display: inline-flex;
  align-items: center;
  gap: var(--dc-space-2);
  font-family: var(--dc-font-sans);
  font-size: var(--dc-text-base);
  color: var(--dc-fg);
  background: var(--dc-surface);
  border: 1px solid var(--dc-border);
  border-radius: var(--dc-radius-sm);
  padding: 0 var(--dc-space-4);
  height: 30px;
  transition: border-color var(--dc-transition-fast), box-shadow var(--dc-transition-fast);
}
.dcui-field:focus-within {
  border-color: var(--dc-focus-ring);
  box-shadow: 0 0 0 2px var(--dc-brand-subtle);
}
.dcui-field[data-size="sm"] { height: 26px; font-size: var(--dc-text-sm); }
.dcui-field[aria-disabled="true"] { opacity: 0.5; }
.dcui-field-input {
  flex: 1;
  min-width: 0;
  font: inherit;
  color: inherit;
  background: none;
  border: 0;
  outline: none;
  padding: 0;
  width: 100%;
}
.dcui-field-input::placeholder { color: var(--dc-fg-subtle); }
.dcui-field-affix {
  font-family: var(--dc-font-mono);
  font-size: var(--dc-text-xs);
  color: var(--dc-fg-muted);
  flex: 0 0 auto;
}
/* tame the native number spinner so it doesn't fight the chrome */
.dcui-field-input[type="number"]::-webkit-inner-spin-button,
.dcui-field-input[type="number"]::-webkit-outer-spin-button { opacity: 0.4; }
`
injectStyle('dcui-input', CSS)

export type InputSize = 'sm' | 'md'

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> {
  size?: InputSize
  /** Leading label slot (mono). */
  prefix?: ReactNode
  /** Trailing unit suffix (mono). */
  suffix?: ReactNode
  /** Style applied to the field wrapper (e.g. a fixed width). */
  wrapperStyle?: CSSProperties
  /** Class applied to the field wrapper. */
  wrapperClassName?: string
}

export function Input({
  size = 'md',
  prefix,
  suffix,
  disabled = false,
  wrapperStyle,
  wrapperClassName,
  ...rest
}: InputProps) {
  return (
    <span
      className={['dcui-field', wrapperClassName].filter(Boolean).join(' ')}
      data-size={size}
      aria-disabled={disabled ? 'true' : undefined}
      style={wrapperStyle}>
      {prefix ? <span className="dcui-field-affix">{prefix}</span> : null}
      <input className="dcui-field-input" disabled={disabled} {...rest} />
      {suffix ? <span className="dcui-field-affix">{suffix}</span> : null}
    </span>
  )
}
