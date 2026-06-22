import { type A11yImpact, defineCases } from '@awarebydefault/display-case'
import { ImpactTag } from './ImpactTag'

const IMPACTS: A11yImpact[] = ['critical', 'serious', 'moderate', 'minor']

export default defineCases(
  'ImpactTag',
  {
    // The full severity scale, worst → least (the order a sorted list shows).
    'All severities': () => (
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        {IMPACTS.map((impact) => (
          <ImpactTag key={impact} impact={impact} />
        ))}
      </div>
    ),
  },
  { level: 'atom' },
)
