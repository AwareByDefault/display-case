import { defineCases } from '@awarebydefault/display-case'

/** A single component for the substrate-axis fixture. */
export default defineCases(
  'Widget',
  {
    Default: () => (
      <p>A widget in a showcase whose substrate declares an axis.</p>
    ),
  },
  { level: 'atom' },
)
