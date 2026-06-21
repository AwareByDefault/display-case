import { defineCases } from 'display-case'

/**
 * A component with a deterministic axe violation: text whose colour contrast is
 * well below the WCAG minimum (grey on grey). Explicit inline colours make the
 * `color-contrast` finding independent of the harness theme. Used by the a11y
 * e2e suite to prove the live panel + nav marker surface a real violation.
 */
export default defineCases(
  'Broken',
  {
    Default: () => (
      <p style={{ color: '#999999', backgroundColor: '#aaaaaa' }}>
        This paragraph has insufficient colour contrast.
      </p>
    ),
  },
  { level: 'atom' },
)
