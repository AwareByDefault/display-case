import { useState } from 'react'
import type { A11yViolation } from '../../../../index'
import { DcTestIds } from '../../../test-ids'
import { IconButton } from '../controls/IconButton'
import { injectStyle } from '../inject-style'
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

const CSS = `
.dcui-a11y {
  flex: 0 0 auto;
  max-height: 13rem;
  overflow-y: auto;
  border: var(--dc-border-line);
  border-left: 3px solid var(--dc-danger);
  border-radius: var(--dc-radius-md);
  background: var(--dc-surface);
  /* Ease the left accent between states (neutral while scanning → green/danger
     on the verdict) instead of snapping. */
  transition: border-left-color var(--dc-transition-base);
}
.dcui-a11y[data-state="pass"] { border-left-color: var(--dc-success); }
/* Scanning / unavailable: a calm neutral accent — no verdict yet. */
.dcui-a11y[data-state="pending"],
.dcui-a11y[data-state="unavailable"] { border-left-color: var(--dc-border); }
/* Collapsed: only the header bar shows, so no need to reserve scroll height. */
.dcui-a11y[data-open="false"] { overflow: hidden; }
.dcui-a11y-head {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--dc-space-4);
  padding: var(--dc-space-3) var(--dc-space-6);
  background: var(--dc-surface);
}
.dcui-a11y[data-open="true"] .dcui-a11y-head { border-bottom: var(--dc-border-line); }
.dcui-a11y-head-right {
  display: flex;
  align-items: center;
  gap: var(--dc-space-2);
  /* Reserve the control-row height (the size-sm IconButton) so every state's bar
     is the same height — the scanning/pass bars have no button, the violations
     bar does, and without this the bar would jump size between them. */
  min-height: 26px;
}
.dcui-a11y-status {
  font-family: var(--dc-font-mono);
  font-size: var(--dc-text-xs);
  font-weight: var(--dc-weight-medium);
  color: var(--dc-danger);
  /* Match the accent: ease the verdict text colour across state changes too. */
  transition: color var(--dc-transition-base);
}
/* On navigation the panel fades out, its state swaps to the new exhibit (behind
   the fade), then fades back in. Hard-switch the accent + status colour during
   that window — easing it would flash the previous exhibit's colour as the panel
   returns, the wrong colour for the now-current state. The ease still applies to
   in-place state changes (a scan resolving while the panel stays visible). */
.dcui-a11y[data-instant-color],
.dcui-a11y[data-instant-color] .dcui-a11y-status {
  transition: none;
}
.dcui-a11y[data-state="pass"] .dcui-a11y-status {
  color: var(--dc-success);
  /* Fade the "Passes WCAG A/AA" verdict in (a slow, gentle fade). */
  animation: dcui-a11y-fade-in 0.45s var(--dc-ease) both;
}
.dcui-a11y[data-state="unavailable"] .dcui-a11y-status {
  color: var(--dc-fg-subtle);
  font-weight: var(--dc-weight-normal);
}
.dcui-a11y[data-state="pending"] .dcui-a11y-status {
  color: var(--dc-fg-subtle);
  font-weight: var(--dc-weight-normal);
  /* Pulse the "Scanning…" text so the in-progress state reads as live. */
  animation: dcui-a11y-scan 1.4s ease-in-out infinite;
}
@keyframes dcui-a11y-scan {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}
@keyframes dcui-a11y-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
/* Each violation row fades + rises in; the per-row stagger (animation-delay, set
   inline by index) makes the list cascade. */
@keyframes dcui-a11y-item-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  /* No pulse on Scanning…, no fade on the pass verdict. (The violations cascade
     is disabled separately, after its rule — see the end of this sheet.) */
  .dcui-a11y[data-state="pending"] .dcui-a11y-status,
  .dcui-a11y[data-state="pass"] .dcui-a11y-status { animation: none; }
}
/* The violations body lives in a grid row. minmax(0, …fr) — not a bare 0fr/1fr —
   so the collapsed row truly reaches 0 (a bare 0fr keeps a min-content floor and
   leaves a sliver of the first row showing). The expand TRANSITION is enabled
   only for a live-scan reveal, so a cached/already-scanned panel appears fully
   expanded at once rather than animating open on load. */
.dcui-a11y-collapse {
  display: grid;
  grid-template-rows: minmax(0, 0fr);
  /* Clip the row: the child overflows the 0-height track when collapsed, so the
     wrapper must hide it or a sliver of the first row shows. */
  overflow: hidden;
}
.dcui-a11y[data-open="true"] .dcui-a11y-collapse {
  grid-template-rows: minmax(0, 1fr);
}
.dcui-a11y-collapse > .dcui-a11y-list {
  overflow: hidden;
  min-height: 0;
}
.dcui-a11y[data-reveal="cascade"] .dcui-a11y-collapse {
  transition: grid-template-rows var(--dc-transition-base);
}
@media (prefers-reduced-motion: reduce) {
  .dcui-a11y,
  .dcui-a11y-status,
  .dcui-a11y[data-reveal="cascade"] .dcui-a11y-collapse { transition: none; }
}
.dcui-a11y-list {
  list-style: none;
  margin: 0;
  padding: var(--dc-space-3) var(--dc-space-6) var(--dc-space-4);
  display: flex;
  flex-direction: column;
  gap: var(--dc-space-2);
}
.dcui-a11y-item {
  display: flex;
  align-items: baseline;
  gap: var(--dc-space-3);
  font-size: var(--dc-text-sm);
}
.dcui-a11y-id {
  flex: 0 0 auto;
  font-family: var(--dc-font-mono);
  font-size: var(--dc-text-xs);
  color: var(--dc-danger);
}
.dcui-a11y-help {
  flex: 1 1 auto;
  min-width: 0;
  color: var(--dc-fg);
}
.dcui-a11y-nodes {
  flex: 0 0 auto;
  font-family: var(--dc-font-mono);
  font-size: var(--dc-text-xs);
  color: var(--dc-fg-subtle);
}
/* Reveal modes (set by the panel's data-reveal). 'cascade' = the verdict just
   resolved from a live scan: rows fade + rise with a per-row stagger (inline
   animation-delay). 'all' = already scanned (e.g. cache hit / navigation): the
   whole list fades in at once, like the stage and tweaks panel. */
.dcui-a11y[data-reveal="cascade"] .dcui-a11y-item {
  animation: dcui-a11y-item-in 0.6s var(--dc-ease) both;
}
.dcui-a11y[data-reveal="all"] .dcui-a11y-list {
  animation: dcui-a11y-fade-in 0.4s var(--dc-ease) both;
}
/* Under reduced motion: no cascade, no fade — the verdict and every row appear
   at once. Placed after the reveal rules (and matching their specificity) so it
   wins; animation: none also nullifies the inline per-row delay. */
@media (prefers-reduced-motion: reduce) {
  .dcui-a11y[data-reveal="cascade"] .dcui-a11y-item,
  .dcui-a11y[data-reveal="all"] .dcui-a11y-list { animation: none; }
}
`
injectStyle('dcui-a11y', CSS)

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
