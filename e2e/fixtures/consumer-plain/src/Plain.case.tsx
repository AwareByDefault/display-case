import { defineCases } from '@awarebydefault/display-case'

/** A single plain component for the a11y-disabled control fixture. */
export default defineCases(
  'Plain',
  {
    Default: () => <p>A plain consumer component with no a11y configured.</p>,
  },
  { level: 'atom' },
)
