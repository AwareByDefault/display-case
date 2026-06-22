import { defineCases, tweak } from '@awarebydefault/display-case'
import { type DefEntry, DefinitionList } from './DefinitionList'

const voice: DefEntry[] = [
  {
    term: 'Voice',
    description:
      'Plain, confident, technical-but-warm. It explains why, briefly, then moves on.',
  },
  {
    term: 'Casing',
    description: (
      <>
        Sentence case everywhere. The one exception is the{' '}
        <strong>eyebrow label</strong>: uppercase mono with wide tracking.
      </>
    ),
  },
  {
    term: 'Length',
    description:
      'Terse. Buttons are one or two words; labels are a single token.',
  },
]

export default defineCases(
  'DefinitionList',
  {
    Playground: {
      tweaks: { termWidth: tweak.text('7.5rem') },
      render: (t) => (
        <DefinitionList entries={voice} termWidth={t.termWidth || undefined} />
      ),
    },
    Voice: () => <DefinitionList entries={voice} />,
  },
  { level: 'molecule' },
)
