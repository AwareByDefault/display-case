import { defineCases, tweak } from '@awarebydefault/display-case'
import { type Swatch, SwatchGrid } from './SwatchGrid'

const roles: Swatch[] = [
  { token: 'bg', color: 'var(--dc-bg)', role: 'canvas' },
  { token: 'bg-subtle', color: 'var(--dc-bg-subtle)', role: 'sidebar' },
  { token: 'surface', color: 'var(--dc-surface)', role: 'inputs' },
  { token: 'border', color: 'var(--dc-border)', role: 'hairline' },
  { token: 'fg', color: 'var(--dc-fg)', role: 'text' },
  { token: 'fg-muted', color: 'var(--dc-fg-muted)', role: 'labels' },
  { token: 'brand', color: 'var(--dc-brand)', role: 'accent' },
  { token: 'brand-subtle', color: 'var(--dc-brand-subtle)', role: 'wash' },
]

export default defineCases(
  'SwatchGrid',
  {
    Playground: {
      tweaks: { columns: tweak.number(4) },
      render: (t) => <SwatchGrid swatches={roles} columns={t.columns} />,
    },
    Roles: () => <SwatchGrid swatches={roles} />,
    TwoUp: () => <SwatchGrid swatches={roles} columns={2} />,
  },
  { level: 'molecule' },
)
