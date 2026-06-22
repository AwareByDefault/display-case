import { defineCases } from '@awarebydefault/display-case'
import { FontFamilies, type FontFamily } from './FontFamilies'

const pairing: FontFamily[] = [
  {
    tag: 'Sans · UI',
    sample: 'Display Case shows the work, not itself',
    note: 'Hanken Grotesk, ui-sans-serif, system-ui…',
  },
  {
    tag: 'Mono · Code',
    sample: '/render/<component>/<case>?theme=dark',
    note: 'JetBrains Mono, ui-monospace, "SF Mono", Menlo…',
    mono: true,
  },
]

export default defineCases(
  'FontFamilies',
  {
    Pairing: () => <FontFamilies families={pairing} />,
  },
  { level: 'molecule' },
)
