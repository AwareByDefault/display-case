import type { ReactNode, SelectHTMLAttributes } from 'react'

/**
 * Display Case — Select
 * Native <select> styled to match the chrome, with a mono caret. Accepts plain
 * options or grouped options (Responsive / Devices), or arbitrary <option>
 * children.
 */

export type SelectSize = 'sm' | 'md'
export type SelectOption = string | { value: string; label?: ReactNode }
export interface SelectOptionGroup {
  label: string
  options: SelectOption[]
}
export type SelectItem = SelectOption | SelectOptionGroup

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  options?: SelectItem[]
  size?: SelectSize
}

function renderOption(o: SelectItem) {
  if (o && typeof o === 'object' && 'options' in o) {
    return (
      <optgroup key={o.label} label={o.label}>
        {o.options.map(renderOption)}
      </optgroup>
    )
  }
  const value = typeof o === 'string' ? o : o.value
  const label = typeof o === 'string' ? o : (o.label ?? o.value)
  return (
    <option key={value} value={value}>
      {label}
    </option>
  )
}

export function Select({
  options = [],
  size = 'md',
  disabled = false,
  children,
  ...rest
}: SelectProps) {
  return (
    <span className="dcui-select" data-size={size}>
      <select className="dcui-select-el" disabled={disabled} {...rest}>
        {children ?? options.map(renderOption)}
      </select>
      <span className="dcui-select-caret" aria-hidden="true">
        ▾
      </span>
    </span>
  )
}
