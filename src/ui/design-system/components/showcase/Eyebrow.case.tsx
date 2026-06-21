import { defineCases, tweak } from 'display-case'
import { Eyebrow } from './Eyebrow'

export default defineCases(
  'Eyebrow',
  {
    Playground: {
      tweaks: {
        label: tweak.text('Components'),
        tone: tweak.choice(['muted', 'accent', 'strong'], 'muted'),
        as: tweak.choice(['div', 'span', 'p'], 'div'),
      },
      render: (t) => (
        <Eyebrow
          tone={t.tone as 'muted' | 'accent' | 'strong'}
          as={t.as as 'div' | 'span' | 'p'}>
          {t.label}
        </Eyebrow>
      ),
    },
    Tones: () => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Eyebrow>Components</Eyebrow>
        <Eyebrow tone="accent">Tweaks</Eyebrow>
        <Eyebrow tone="strong">Documentation</Eyebrow>
      </div>
    ),
  },
  { level: 'atom' },
)
