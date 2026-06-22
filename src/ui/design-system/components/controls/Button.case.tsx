import { defineCases, tweak } from '@awarebydefault/display-case'
import { Button } from './Button'

export default defineCases(
  'Button',
  {
    Playground: {
      tweaks: {
        label: tweak.text('Button'),
        variant: tweak.choice(
          ['ghost', 'primary', 'accent', 'subtle'],
          'ghost',
        ),
        size: tweak.choice(['sm', 'md', 'lg'], 'md'),
        pressed: tweak.boolean(false),
        disabled: tweak.boolean(false),
      },
      render: (t) => (
        <Button
          variant={t.variant as 'ghost' | 'primary' | 'accent' | 'subtle'}
          size={t.size as 'sm' | 'md' | 'lg'}
          aria-pressed={t.pressed}
          disabled={t.disabled}>
          {t.label}
        </Button>
      ),
    },
    Variants: () => (
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button>Ghost</Button>
        <Button variant="primary">Primary</Button>
        <Button variant="accent">Accent</Button>
        <Button variant="subtle">Subtle</Button>
      </div>
    ),
    Sizes: () => (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Button size="sm">Small</Button>
        <Button size="md">Medium</Button>
        <Button size="lg">Large</Button>
      </div>
    ),
    Toggle: () => (
      <div style={{ display: 'flex', gap: 8 }}>
        <Button aria-pressed={false}>Off</Button>
        <Button aria-pressed>On</Button>
      </div>
    ),
    Disabled: () => <Button disabled>Disabled</Button>,
  },
  { level: 'atom' },
)
