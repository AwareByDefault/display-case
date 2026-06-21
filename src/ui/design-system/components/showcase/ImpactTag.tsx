import type { A11yImpact } from '../../../../index'

/**
 * Display Case — ImpactTag
 * A severity tag for an accessibility violation, colour-graded by axe impact
 * (critical → minor) so the worst findings read hottest. Used in the
 * {@link A11yPanel} violation list; `impactRank` orders a list worst-first.
 */

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
