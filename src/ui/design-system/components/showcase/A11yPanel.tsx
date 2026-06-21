import { useState } from 'react'
import type { A11yViolation } from '../../../../index'
import { DcTestIds } from '../../../test-ids'
import { IconButton } from '../controls/IconButton'
import { Eyebrow } from './Eyebrow'
import { ImpactTag, impactRank } from './ImpactTag'

/**
 * Display Case — A11yPanel
 * The stage's accessibility verdict for the variant on the stage. Four states:
 * `'pending'` while a scan is in flight (a calm, pulsing "Scanning…" bar),
 * `'unavailable'` when the scan prerequisite can't run, an empty array for a
 * clean pass (green bar), or the violations (danger bar + a collapsible list,
 * ordered worst-first with an {@link ImpactTag}). Only the violations state has a
 * body to expand/collapse — the others say everything in the single header bar.
 * Pass `onRescan` to show the ⟳ re-scan control.
 *
 * Height-capped + internally scrollable, with a sticky header so the verdict and
 * controls never scroll away. Padding lives on the head and body (not the
 * section) so the sticky header's background spans edge-to-edge while scrolling.
 */

export interface A11yPanelProps {
  /** The active variant's verdict: `'pending'`, `'unavailable'`, `[]` (clean),
   *  or the violations. */
  violations: A11yViolation[] | 'pending' | 'unavailable'
  /** How the resolved verdict animates in. `'cascade'` (the verdict just resolved
   *  from a live scan): violation rows fade + rise with a per-row stagger.
   *  `'all'` (default — already scanned, e.g. navigated to a cached variant):
   *  the verdict fades in at once, like the stage and tweaks panel. */
  reveal?: 'cascade' | 'all'
  /** Re-run the audit for the viewed variant. When omitted (a static exhibit
   *  that doesn't wire it), the ⟳ re-scan control is hidden. */
  onRescan?: () => void
  /** Snap the accent/status colour instead of easing it. Set while the panel is
   *  mid-navigation crossfade (faded out) so the new exhibit's verdict colour is
   *  in place before it fades back in, rather than easing the old colour across
   *  the fade. The colour ease stays on for in-place state changes. */
  instantColor?: boolean
}

export function A11yPanel({
  violations,
  reveal = 'all',
  onRescan,
  instantColor,
}: A11yPanelProps) {
  // Show/hide is a local UI concern (no need to persist like the docs panel).
  // Only the violations list collapses; the other states are a single bar.
  const [open, setOpen] = useState(true)
  const list = Array.isArray(violations) ? violations : []
  const pending = violations === 'pending'
  const unavailable = violations === 'unavailable'
  const passing = Array.isArray(violations) && violations.length === 0
  const collapsible = list.length > 0
  let state: 'pending' | 'unavailable' | 'pass' | 'fail'
  if (pending) state = 'pending'
  else if (unavailable) state = 'unavailable'
  else if (passing) state = 'pass'
  else state = 'fail'
  let status: string
  if (pending) status = 'Scanning…'
  else if (unavailable) status = 'Unavailable'
  else if (passing) status = 'Passes WCAG A/AA'
  else status = `${list.length} violation${list.length === 1 ? '' : 's'}`
  // Worst first, then most-affected first — so the most urgent fixes lead.
  const sorted = collapsible
    ? [...list].sort(
        (a, b) =>
          impactRank(a.impact) - impactRank(b.impact) || b.nodes - a.nodes,
      )
    : []
  return (
    <section
      className="dcui-a11y"
      data-testid={DcTestIds.a11yPanel}
      data-state={state}
      data-reveal={reveal}
      data-instant-color={instantColor ? 'true' : undefined}
      data-open={collapsible && open ? 'true' : undefined}
      aria-label="Accessibility">
      <div className="dcui-a11y-head">
        <Eyebrow>Accessibility</Eyebrow>
        <div className="dcui-a11y-head-right">
          <span className="dcui-a11y-status">{status}</span>
          {/* Re-scan the viewed variant. Hidden while a scan is in flight, and
              absent entirely when no handler is wired. */}
          {onRescan && !pending && (
            <IconButton
              glyph="⟳"
              variant="bare"
              size="sm"
              data-testid={DcTestIds.a11yRescan}
              label="Re-scan accessibility"
              onClick={onRescan}
            />
          )}
          {/* Only the violations list is collapsible — the other states are a
              single self-explaining bar with no body to toggle. */}
          {collapsible && (
            <IconButton
              glyph={open ? '▾' : '▸'}
              variant="bare"
              size="sm"
              data-testid={DcTestIds.a11yToggle}
              aria-expanded={open}
              label={
                open
                  ? 'Hide accessibility details'
                  : 'Show accessibility details'
              }
              onClick={() => setOpen((o) => !o)}
            />
          )}
        </div>
      </div>
      {/* Always render the wrapper so the 0fr→1fr height transition fires when a
          scan resolves to violations; the list mounts inside only when there are
          violations to show. */}
      <div className="dcui-a11y-collapse">
        {collapsible && (
          <ul className="dcui-a11y-list">
            {sorted.map((v, i) => (
              <li
                key={v.id}
                className="dcui-a11y-item"
                data-testid={DcTestIds.a11yViolation(v.id)}
                // Stagger the cascade; reduced-motion drops the animation, so this
                // delay has no effect there (everything appears at once).
                style={{ animationDelay: `${i * 100}ms` }}>
                {v.impact && <ImpactTag impact={v.impact} />}
                <code className="dcui-a11y-id">{v.id}</code>
                <span className="dcui-a11y-help">{v.help}</span>
                <span className="dcui-a11y-nodes">
                  {v.nodes} node{v.nodes === 1 ? '' : 's'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
