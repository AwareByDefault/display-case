/**
 * Example: a multi-variant case.
 *
 * Several named cases for one component, each demonstrating a different facet.
 * Case keys preserve insertion order, so the sidebar lists them in the order
 * written. A single case can also compose multiple instances side by side.
 *
 * Subject: `FlowNav`, Display Case's own molecule — the flow stepper. Display
 * Case dogfoods itself, so its UI parts make good case subjects.
 *
 * These fixed-input cases are the stable surface for visual regression — see
 * ../testing.md.
 */
import { defineCases } from 'display-case'
import { FlowNav } from './flow-nav'

const steps = ['Request link', 'Check email', 'Signed in']

export default defineCases(
  'FlowNav',
  {
    // A mid-flow state: second step active, the first already done.
    InProgress: () => <FlowNav steps={steps} current={1} />,
    // The first step, nothing completed yet.
    Start: () => <FlowNav steps={steps} current={0} />,
    // The final step, every prior step completed.
    Complete: () => <FlowNav steps={steps} current={2} />,
  },
  { level: 'molecule' },
)
