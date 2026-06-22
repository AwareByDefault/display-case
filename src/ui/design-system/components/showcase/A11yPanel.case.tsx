import { type A11yViolation, defineCases } from '@awarebydefault/display-case'
import type { ReactNode } from 'react'
import { A11yPanel } from './A11yPanel'

// Real-shaped violations (axe rule id, help, node count, severity).
const VIOLATIONS: A11yViolation[] = [
  {
    id: 'color-contrast',
    help: 'Elements must meet minimum color contrast ratio thresholds',
    nodes: 3,
    impact: 'serious',
  },
  {
    id: 'label',
    help: 'Form elements must have labels',
    nodes: 1,
    impact: 'critical',
  },
  {
    id: 'select-name',
    help: 'Select element must have an accessible name',
    nodes: 1,
    impact: 'serious',
  },
]

// Enough violations to overflow the height cap and exercise the internal scroll.
const MANY: A11yViolation[] = [
  ...VIOLATIONS,
  {
    id: 'button-name',
    help: 'Buttons must have discernible text',
    nodes: 2,
    impact: 'critical',
  },
  {
    id: 'image-alt',
    help: 'Images must have alternate text',
    nodes: 5,
    impact: 'critical',
  },
  {
    id: 'link-name',
    help: 'Links must have discernible text',
    nodes: 3,
    impact: 'serious',
  },
  {
    id: 'list',
    help: 'Lists must only directly contain li elements',
    nodes: 2,
    impact: 'serious',
  },
  {
    id: 'heading-order',
    help: 'Heading levels should only increase by one',
    nodes: 1,
    impact: 'moderate',
  },
  {
    id: 'region',
    help: 'All page content should be contained by landmarks',
    nodes: 6,
    impact: 'moderate',
  },
  {
    id: 'duplicate-id',
    help: 'id attribute values must be unique',
    nodes: 3,
    impact: 'minor',
  },
]

// The panel is height-capped and otherwise full-width; give it a realistic
// column to sit in.
function Frame({ children }: { children: ReactNode }) {
  return <div style={{ width: '34rem', maxWidth: '100%' }}>{children}</div>
}

export default defineCases(
  'A11yPanel',
  {
    // Violations: danger bar + collapsible list, ordered worst-first with tags.
    Violations: () => (
      <Frame>
        <A11yPanel violations={VIOLATIONS} />
      </Frame>
    ),
    // Scanning: a calm, pulsing single bar (no list, no toggle).
    Scanning: () => (
      <Frame>
        <A11yPanel violations="pending" />
      </Frame>
    ),
    // Clean: the reassuring green pass bar.
    'All clear': () => (
      <Frame>
        <A11yPanel violations={[]} />
      </Frame>
    ),
    // Unavailable: the scan prerequisite can't run.
    Unavailable: () => (
      <Frame>
        <A11yPanel violations="unavailable" />
      </Frame>
    ),
    // A long list overflows the height cap and scrolls under the sticky header.
    Scrolling: () => (
      <Frame>
        <A11yPanel violations={MANY} />
      </Frame>
    ),
    // With the ⟳ re-scan control wired (click logs in this exhibit).
    'With re-scan': () => (
      <Frame>
        <A11yPanel violations={VIOLATIONS} onRescan={() => {}} />
      </Frame>
    ),
  },
  { level: 'organism' },
)
