import type { CSSProperties, InputHTMLAttributes, ReactNode } from 'react'

/**
 * Display Case — Input
 * Text / number field. Supports a leading label slot and a trailing unit suffix
 * (used by the device-dimension fields: 1280 × 800). The border + marigold
 * focus ring live on the wrapper so prefix/suffix sit inside the field.
 */

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
