import type { CSSProperties, ReactNode } from 'react'
import { injectStyle } from '../inject-style'

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

const CSS = `
.dcui-segmented {
  position: relative;
  display: grid;
  grid-template-columns: repeat(var(--seg-count), 1fr);
  gap: var(--dc-space-1);
  padding: var(--dc-space-1);
  border: var(--dc-border-line);
  border-radius: var(--dc-radius-sm);
  background: var(--dc-bg);
}
/* The highlight box: one cell-wide thumb pinned inside the padding box. The gap
   between cells (and the padding around them) is one --dc-space-1; its width is a
   single grid cell — (track − the N+1 gaps) divided by N — so translating by its
   own width plus one gap, times the active index, lands it exactly over any
   segment. The transform transition does the linear lerp across the list. */
.dcui-segmented-thumb {
  position: absolute;
  top: var(--dc-space-1);
  bottom: var(--dc-space-1);
  left: var(--dc-space-1);
  width: calc((100% - (var(--seg-count) + 1) * var(--dc-space-1)) / var(--seg-count));
  transform: translateX(calc((100% + var(--dc-space-1)) * var(--seg-index)));
  border-radius: calc(var(--dc-radius-sm) - 1px);
  background: var(--dc-brand);
  transition: transform var(--dc-transition-base);
  pointer-events: none;
}
.dcui-segmented-seg {
  position: relative;
  z-index: 1;
  appearance: none;
  border: 0;
  border-radius: calc(var(--dc-radius-sm) - 1px);
  padding: var(--dc-space-2) var(--dc-space-4);
  font-family: var(--dc-font-mono);
  font-size: var(--dc-text-xs);
  font-weight: var(--dc-weight-medium);
  letter-spacing: var(--dc-tracking-label);
  text-transform: uppercase;
  color: var(--dc-fg-muted);
  background: transparent;
  cursor: pointer;
  transition: color var(--dc-transition-base);
}
/* Only the inactive segments take a hover fill — the active one sits over the
   thumb, which already carries the brand background. */
.dcui-segmented-seg:not([data-active="true"]):hover {
  color: var(--dc-fg);
  background: var(--dc-hover);
}
.dcui-segmented-seg[data-active="true"] {
  color: var(--dc-brand-fg);
}
@media (prefers-reduced-motion: reduce) {
  .dcui-segmented-thumb {
    transition: none;
  }
}
`
injectStyle('dcui-segmented', CSS)

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
