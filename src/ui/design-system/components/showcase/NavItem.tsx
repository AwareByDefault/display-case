import type { ReactNode } from 'react'
import { injectStyle } from '../inject-style'
import { A11yBadge } from './A11yBadge'

/**
 * Display Case — NavItem
 * One row in the sidebar tree. `kind="component"` renders a disclosure chevron +
 * name (+ optional case count); when no `onToggle` is given (a component with a
 * single case) the chevron is replaced by a same-width spacer and the count is
 * omitted, so the row reads as a plain leaf that still aligns with its siblings.
 * `kind="case"` renders an indented case link that lines up under the component
 * name. The active row is marigold with a left tick.
 */

const CSS = `
.dcui-navrow {
  display: flex;
  align-items: center;
  gap: var(--dc-space-1);
  width: 100%;
  box-sizing: border-box;
  position: relative;
}
.dcui-nav-disclosure {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 22px;
  border: 0;
  background: none;
  color: var(--dc-fg-subtle);
  cursor: pointer;
  border-radius: var(--dc-radius-sm);
  padding: 0;
  transition: color var(--dc-transition-fast), background var(--dc-transition-fast);
}
.dcui-nav-disclosure:hover { color: var(--dc-fg); background: var(--dc-hover); }
/* A non-expandable component row (single case) keeps the chevron's footprint so
   its name still lines up under expandable siblings — just with no glyph. */
.dcui-nav-disclosure-spacer { flex: 0 0 auto; width: 20px; height: 22px; }
.dcui-chevron {
  font-family: var(--dc-font-mono);
  font-size: 0.65rem;
  line-height: 1;
  transition: transform var(--dc-transition-fast);
}
.dcui-chevron[data-expanded="true"] { transform: rotate(90deg); }
.dcui-nav-name {
  flex: 1;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: var(--dc-space-3);
  text-align: left;
  font-family: var(--dc-font-sans);
  font-size: var(--dc-text-base);
  font-weight: var(--dc-weight-medium);
  color: var(--dc-fg);
  border: 0;
  background: none;
  cursor: pointer;
  padding: 0.25rem var(--dc-space-3);
  border-radius: var(--dc-radius-sm);
  overflow: hidden;
  transition: background var(--dc-transition-fast), color var(--dc-transition-fast);
}
/* The name text itself truncates; the alert pill beside it never shrinks. */
.dcui-nav-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dcui-nav-name:hover { background: var(--dc-hover); }
.dcui-nav-count {
  font-family: var(--dc-font-mono);
  font-size: var(--dc-text-xs);
  color: var(--dc-fg-subtle);
  flex: 0 0 auto;
  padding-right: var(--dc-space-3);
}
/* Case rows indent so their text lines up under the component name (chevron
   width + row gap, then the name's own text padding). */
.dcui-navrow[data-kind="case"] { padding-left: calc(20px + var(--dc-space-1)); }
.dcui-navrow[data-kind="case"] .dcui-nav-name {
  font-weight: var(--dc-weight-normal);
  font-size: var(--dc-text-sm);
  color: var(--dc-fg-muted);
}
.dcui-navrow[data-kind="case"] .dcui-nav-name:hover { color: var(--dc-fg); }
.dcui-navrow[data-current="true"] .dcui-nav-name {
  color: var(--dc-brand);
  font-weight: var(--dc-weight-medium);
}
.dcui-navrow[data-current="true"]::before {
  content: "";
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 2px;
  height: 1rem;
  border-radius: 1px;
  background: var(--dc-brand);
}
`
injectStyle('dcui-navitem', CSS)

export type NavItemKind = 'component' | 'case'

export interface NavItemProps {
  kind?: NavItemKind
  label: ReactNode
  count?: ReactNode
  current?: boolean
  expanded?: boolean
  /** Accessibility marker. A positive number renders a counted danger pill; the
   *  string `'dot'` renders an unnumbered danger dot — used on an *expanded*
   *  component whose per-variant counts have moved onto its case rows, so the
   *  parent flags "issues here" without competing with the child numbers. Omit
   *  or `0` for none. */
  alert?: number | 'dot'
  onSelect?: () => void
  onToggle?: () => void
  /** `data-testid` for the select (name) button. */
  testId?: string
  /** `data-testid` for the disclosure chevron (component rows only). */
  toggleTestId?: string
  /** `data-testid` for the a11y-violation marker. */
  alertTestId?: string
}

export function NavItem({
  kind = 'component',
  label,
  count,
  current = false,
  expanded = false,
  alert,
  onSelect,
  onToggle,
  testId,
  toggleTestId,
  alertTestId,
}: NavItemProps) {
  // The a11y marker (a counted pill, or a bare 'dot' on an expanded parent) is
  // the standalone A11yBadge; render it only for a positive count / 'dot'.
  const showAlert = alert === 'dot' || (typeof alert === 'number' && alert > 0)
  // Component rows lead with a disclosure chevron; a component with no `onToggle`
  // (a single case) gets a same-width spacer instead so its name still aligns
  // under expandable siblings. Case rows lead with nothing.
  let disclosure: ReactNode = null
  if (kind === 'component') {
    disclosure = onToggle ? (
      <button
        type="button"
        className="dcui-nav-disclosure"
        aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
        aria-expanded={expanded}
        data-testid={toggleTestId}
        onClick={onToggle}>
        <span className="dcui-chevron" data-expanded={expanded}>
          ▸
        </span>
      </button>
    ) : (
      <span className="dcui-nav-disclosure-spacer" aria-hidden="true" />
    )
  }
  return (
    <div
      className="dcui-navrow"
      data-kind={kind}
      data-current={current ? 'true' : undefined}>
      {disclosure}
      <button
        type="button"
        className="dcui-nav-name"
        aria-current={current ? 'true' : undefined}
        data-testid={testId}
        onClick={onSelect}>
        <span className="dcui-nav-label">{label}</span>
        {showAlert && alert !== undefined && (
          <A11yBadge value={alert} testId={alertTestId} />
        )}
      </button>
      {count != null ? <span className="dcui-nav-count">{count}</span> : null}
    </div>
  )
}
