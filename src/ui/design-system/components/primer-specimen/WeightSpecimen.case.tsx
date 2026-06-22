import { defineCases } from '@awarebydefault/display-case'
import { Eyebrow } from '../showcase/Eyebrow'
import { type WeightSpec, WeightSpecimen } from './WeightSpecimen'

const weights: WeightSpec[] = [
  { weight: 400, name: 'Normal', role: 'body' },
  { weight: 500, name: 'Medium', role: 'active' },
  { weight: 600, name: 'Semibold', role: 'titles' },
]

export default defineCases(
  'WeightSpecimen',
  {
    Weights: () => <WeightSpecimen weights={weights} />,
    WithFooter: () => (
      <WeightSpecimen
        weights={weights}
        footer={
          <>
            <div className="dcpl-divider" />
            <Eyebrow>Group label · 11px / 500 / 0.08em uppercase</Eyebrow>
          </>
        }
      />
    ),
  },
  { level: 'molecule' },
)
