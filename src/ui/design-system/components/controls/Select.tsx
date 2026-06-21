import type { ReactNode, SelectHTMLAttributes } from 'react'
import { injectStyle } from '../inject-style'

/**
 * Display Case — Select
 * Native <select> styled to match the chrome, with a mono caret. Accepts plain
 * options or grouped options (Responsive / Devices), or arbitrary <option>
 * children.
 */

const CSS = `
.dcui-select {
  position: relative;
  display: inline-flex;
  align-items: center;
}
.dcui-select-el {
  appearance: none;
  -webkit-appearance: none;
  font-family: var(--dc-font-sans);
  font-size: var(--dc-text-base);
  color: var(--dc-fg);
  background: var(--dc-surface);
  border: 1px solid var(--dc-border);
  border-radius: var(--dc-radius-sm);
  padding: 0 calc(var(--dc-space-8) + 0.5rem) 0 var(--dc-space-4);
  height: 30px;
  cursor: pointer;
  transition: border-color var(--dc-transition-fast), background var(--dc-transition-fast);
}
.dcui-select-el:hover { background: var(--dc-hover); }
.dcui-select-el:focus-visible { outline: 2px solid var(--dc-focus-ring); outline-offset: 1px; }
.dcui-select[data-size="sm"] .dcui-select-el { height: 26px; font-size: var(--dc-text-sm); }
.dcui-select-caret {
  position: absolute;
  right: var(--dc-space-4);
  font-family: var(--dc-font-mono);
  font-size: var(--dc-text-sm);
  color: var(--dc-fg-muted);
  pointer-events: none;
}
.dcui-select-el:disabled { opacity: 0.5; cursor: not-allowed; }
`
injectStyle('dcui-select', CSS)

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
