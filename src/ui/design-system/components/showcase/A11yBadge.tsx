/**
 * Display Case — A11yBadge
 * The nav-rail accessibility marker. A positive number renders a counted danger
 * pill; `'dot'` renders an unnumbered danger dot — used on an *expanded*
 * component whose per-variant counts have moved onto its case rows, so the parent
 * still flags "issues here" without competing with the child numbers. The caller
 * decides whether to render it (omit for a clean / unmarked row).
 */

export interface A11yBadgeProps {
  /** A positive count renders a numbered pill; `'dot'` renders a bare dot. */
  value: number | 'dot'
  /** `data-testid` for locating the marker in tests. */
  testId?: string
}

export function A11yBadge({ value, testId }: A11yBadgeProps) {
  if (value === 'dot') {
    return (
      <span
        className="dcui-a11y-badge"
        data-dot="true"
        role="img"
        data-testid={testId}
        title="Accessibility violations across variants"
        aria-label="Has accessibility violations across variants"
      />
    )
  }
  const text = `${value} accessibility violation${value === 1 ? '' : 's'}`
  return (
    <span
      className="dcui-a11y-badge"
      role="img"
      data-testid={testId}
      title={text}
      aria-label={text}>
      {value}
    </span>
  )
}
