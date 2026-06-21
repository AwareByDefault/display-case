import { defineCases } from 'display-case'
import { type SpaceStep, SpacingScale } from './SpacingScale'

const steps: SpaceStep[] = [
  { token: 'space-1', value: '2px', width: 2 },
  { token: 'space-2', value: '4px', width: 4 },
  { token: 'space-4', value: '8px', width: 8 },
  { token: 'space-6', value: '12px', width: 12 },
  { token: 'space-8', value: '16px', width: 16 },
  { token: 'space-10', value: '20px', width: 20 },
  { token: 'space-16', value: '32px', width: 32 },
]

export default defineCases(
  'SpacingScale',
  {
    Scale: () => <SpacingScale steps={steps} />,
  },
  { level: 'molecule' },
)
