import { defineCases, tweak } from '@awarebydefault/display-case'
import { Input } from './Input'

export default defineCases(
  'Input',
  {
    Playground: {
      tweaks: {
        placeholder: tweak.text('filter by name'),
        value: tweak.text(''),
        prefix: tweak.text(''),
        suffix: tweak.text(''),
        type: tweak.choice(['text', 'number', 'search'], 'text'),
        size: tweak.choice(['sm', 'md'], 'md'),
        disabled: tweak.boolean(false),
      },
      render: (t) => (
        <Input
          placeholder={t.placeholder}
          defaultValue={t.value || undefined}
          prefix={t.prefix || undefined}
          suffix={t.suffix || undefined}
          type={t.type}
          size={t.size ?? 'md'}
          disabled={t.disabled}
          wrapperStyle={{ width: '14rem' }}
        />
      ),
    },
    Default: () => <Input placeholder="filter by name" />,
    WithAffixes: () => (
      <Input
        aria-label="Width in pixels"
        type="number"
        defaultValue={1280}
        prefix="W"
        suffix="px"
        wrapperStyle={{ width: '7rem' }}
      />
    ),
    Sizes: () => (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Input size="sm" placeholder="Small" />
        <Input size="md" placeholder="Medium" />
      </div>
    ),
    Disabled: () => <Input placeholder="disabled" disabled />,
  },
  { level: 'atom' },
)
