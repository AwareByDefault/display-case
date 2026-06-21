import { defineCases } from 'display-case'

/** A component with no accessibility violations — high-contrast text — so the
 *  a11y e2e suite can assert the panel's clean "pass" state and no nav marker. */
export default defineCases(
  'Clean',
  {
    Default: () => (
      <p style={{ color: '#111111', backgroundColor: '#ffffff' }}>
        This paragraph has plenty of contrast.
      </p>
    ),
  },
  { level: 'atom' },
)
