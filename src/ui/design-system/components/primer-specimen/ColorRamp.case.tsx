import { defineCases, tweak } from '@awarebydefault/display-case'
import { ColorRamp, type ColorStop } from './ColorRamp'

const marigold: ColorStop[] = [
  { name: 'marigold-300', color: 'var(--dc-marigold-300)', caption: '#f6c878' },
  { name: 'marigold-400', color: 'var(--dc-marigold-400)', caption: '#f0a23b' },
  { name: 'marigold-500', color: 'var(--dc-marigold-500)', caption: '#e0820b' },
  {
    name: 'marigold-600',
    color: 'var(--dc-marigold-600)',
    caption: '#c2690a',
    star: true,
  },
  { name: 'marigold-700', color: 'var(--dc-marigold-700)', caption: '#9a4f0a' },
]

const paper: ColorStop[] = [
  { name: 'paper-100', color: 'var(--dc-paper-100)', caption: '#f4f1e9' },
  { name: 'paper-300', color: 'var(--dc-paper-300)', caption: '#d6cebe' },
  { name: 'paper-500', color: 'var(--dc-paper-500)', caption: '#8a8073' },
  { name: 'paper-700', color: 'var(--dc-paper-700)', caption: '#4a423a' },
  { name: 'paper-900', color: 'var(--dc-paper-900)', caption: '#211d18' },
]

export default defineCases(
  'ColorRamp',
  {
    Playground: {
      tweaks: {
        chipHeight: tweak.number(56),
        star: tweak.boolean(true),
      },
      render: (t) => (
        <ColorRamp
          chipHeight={t.chipHeight}
          stops={marigold.map((s) => ({ ...s, star: s.star && t.star }))}
        />
      ),
    },
    Accent: () => <ColorRamp stops={marigold} />,
    Neutral: () => <ColorRamp stops={paper} chipHeight={48} />,
  },
  { level: 'molecule' },
)
