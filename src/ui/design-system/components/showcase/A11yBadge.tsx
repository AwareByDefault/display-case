import { injectStyle } from '../inject-style'

/**
 * Display Case — A11yBadge
 * The nav-rail accessibility marker. A positive number renders a counted danger
 * pill; `'dot'` renders an unnumbered danger dot — used on an *expanded*
 * component whose per-variant counts have moved onto its case rows, so the parent
 * still flags "issues here" without competing with the child numbers. The caller
 * decides whether to render it (omit for a clean / unmarked row).
 */

const CSS = `
.dcui-a11y-badge {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 0.95rem;
  height: 0.95rem;
  padding: 0 0.2rem;
  border-radius: 999px;
  /* The fixed ramp red, not --dc-danger: this pill carries white text, so it
     needs a fill dark enough for AA in both themes. --dc-danger is the lighter
     text-role hue in dark (for danger *text* on charcoal) and would drop the
     white count below AA here. */
  background: var(--dc-red-600);
  color: #ffffff;
  font-family: var(--dc-font-mono);
  font-size: var(--dc-text-xs);
  font-weight: var(--dc-weight-medium);
  line-height: 1;
}
/* Dot variant: a bare danger dot (no number — the counts live on the case rows). */
.dcui-a11y-badge[data-dot="true"] {
  min-width: 0;
  width: 0.5rem;
  height: 0.5rem;
  padding: 0;
}
`
injectStyle('dcui-a11y-badge', CSS)

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
