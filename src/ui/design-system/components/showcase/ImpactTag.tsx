import type { A11yImpact } from '../../../../index'
import { injectStyle } from '../inject-style'

/**
 * Display Case — ImpactTag
 * A severity tag for an accessibility violation, colour-graded by axe impact
 * (critical → minor) so the worst findings read hottest. Used in the
 * {@link A11yPanel} violation list; `impactRank` orders a list worst-first.
 */

const CSS = `
.dcui-impact-tag {
  flex: 0 0 auto;
  align-self: center;
  min-width: 4.2rem;
  text-align: center;
  padding: 0 var(--dc-space-2);
  border-radius: var(--dc-radius-sm);
  font-family: var(--dc-font-mono);
  font-size: var(--dc-text-2xs);
  font-weight: var(--dc-weight-medium);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  /* Each severity carries its own text colour so the fill+text pair clears AA
     theme-independently — a single --dc-brand-fg (white in light, ink in dark)
     could not, since the fills span a light amber to a dark red. The fills are
     the fixed ramp hues (not theme tokens), so the gradient — critical hottest
     → minor coolest — and the contrast both hold in light and dark alike. */
  color: #ffffff;
  background: var(--dc-paper-700);
}
.dcui-impact-tag[data-impact="critical"] { background: var(--dc-red-700); color: #ffffff; }
.dcui-impact-tag[data-impact="serious"] { background: var(--dc-red-600); color: #ffffff; }
.dcui-impact-tag[data-impact="moderate"] { background: var(--dc-amber-500); color: var(--dc-paper-900); }
.dcui-impact-tag[data-impact="minor"] { background: var(--dc-paper-700); color: #ffffff; }
`
injectStyle('dcui-impact-tag', CSS)

// Worst → least, so a list sorts top-down. Unclassified (null) sorts last.
const RANK: Record<A11yImpact, number> = {
  critical: 0,
  serious: 1,
  moderate: 2,
  minor: 3,
}

/** Sort key for an impact (worst first); `null`/unclassified sorts last. */
export const impactRank = (impact: A11yImpact | null): number =>
  impact ? RANK[impact] : 4

export interface ImpactTagProps {
  impact: A11yImpact
}

export function ImpactTag({ impact }: ImpactTagProps) {
  return (
    <span
      className="dcui-impact-tag"
      data-impact={impact}
      title={`Severity: ${impact}`}>
      {impact}
    </span>
  )
}
