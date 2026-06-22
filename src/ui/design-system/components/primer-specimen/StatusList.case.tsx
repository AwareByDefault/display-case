import { defineCases } from '@awarebydefault/display-case'
import { type StatusItem, StatusList } from './StatusList'

const hues: StatusItem[] = [
  { name: 'success', color: 'var(--dc-success)', caption: 'green-600' },
  { name: 'warning', color: 'var(--dc-warning)', caption: 'amber-500' },
  { name: 'danger', color: 'var(--dc-danger)', caption: 'red-600' },
]

export default defineCases(
  'StatusList',
  {
    Statuses: () => <StatusList items={hues} />,
    Single: () => <StatusList items={[hues[0]]} />,
  },
  { level: 'molecule' },
)
