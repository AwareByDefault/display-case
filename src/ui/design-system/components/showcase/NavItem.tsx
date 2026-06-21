import type { ReactNode } from 'react'
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
