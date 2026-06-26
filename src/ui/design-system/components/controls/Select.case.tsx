import { defineCases, tweak } from '@awarebydefault/display-case'
import { Select } from './Select'

const grouped = [
  { label: 'Responsive', options: ['Responsive', 'Desktop', 'Tablet'] },
  { label: 'Devices', options: ['iPhone 14', 'iPad', 'Pixel 7'] },
]

export default defineCases(
  'Select',
  {
    Playground: {
      tweaks: {
        value: tweak.choice(['text', 'number', 'boolean'], 'number'),
        size: tweak.choice(['sm', 'md'], 'md'),
        disabled: tweak.boolean(false),
      },
      render: (t) => (
        <Select
          aria-label="Field type"
          options={['text', 'number', 'boolean']}
          defaultValue={t.value}
          size={t.size ?? 'md'}
          disabled={t.disabled}
        />
      ),
    },
    Options: () => (
      <Select
        aria-label="Field type"
        options={['text', 'number', 'boolean']}
        defaultValue="number"
      />
    ),
    Grouped: () => (
      <Select aria-label="Viewport" options={grouped} defaultValue="Desktop" />
    ),
    Disabled: () => (
      <Select
        aria-label="Field type"
        options={['text', 'number']}
        disabled
        defaultValue="text"
      />
    ),
  },
  { level: 'atom' },
)
