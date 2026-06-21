import type { CSSProperties, ReactNode } from 'react'

/**
 * Display Case — SegmentedToggle
 * An isolated, multi-option segmented control. Takes any number of options and
 * animates a single brand-filled thumb linearly from one to the next: the thumb
 * is sized to one cell and translated by `index` cells, so the highlight lerps
 * across the list however many options there are — no per-count CSS.
 *
 * The geometry is driven entirely by two custom properties set inline on the
 * root (`--seg-count`, `--seg-index`); the CSS below is option-count agnostic.
 */

export interface SegmentedOption<T extends string> {
  id: T
  label: ReactNode
}

export interface SegmentedToggleProps<T extends string> {
  /** The options, in display order. The thumb slides across them by index. */
  options: SegmentedOption<T>[]
  /** The currently selected option id. */
  value: T
  /** Called with the chosen option id when a segment is activated. */
  onChange: (id: T) => void
  /** Accessible name for the tablist (e.g. "View mode"). */
  label: string
  /** Optional className applied to the root, for layout-context placement. */
  className?: string
  /** Optional per-segment `data-testid` factory. */
  testId?: (id: T) => string
}

export function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
  testId,
}: SegmentedToggleProps<T>) {
  // Clamp to 0 so an unknown `value` parks the thumb on the first cell rather
  // than translating it off the track by a negative index.
  const activeIndex = Math.max(
    0,
    options.findIndex((o) => o.id === value),
  )
  return (
    <div
      className={className ? `dcui-segmented ${className}` : 'dcui-segmented'}
      role="tablist"
      aria-label={label}
      style={
        {
          '--seg-count': options.length,
          '--seg-index': activeIndex,
        } as CSSProperties
      }>
      <span className="dcui-segmented-thumb" aria-hidden="true" />
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          role="tab"
          aria-selected={value === opt.id}
          className="dcui-segmented-seg"
          data-testid={testId?.(opt.id)}
          data-active={value === opt.id ? 'true' : undefined}
          onClick={() => onChange(opt.id)}>
          {opt.label}
        </button>
      ))}
    </div>
  )
}
