import { defineCases } from 'display-case'
import { TypeScale, type TypeStep } from './TypeScale'

const scale: TypeStep[] = [
  { tag: 'xl · 28', size: '28px', sample: 'Doc heading' },
  { tag: 'lg · 20', size: '20px', sample: 'Section title' },
  { tag: 'md · 16', size: '16px', sample: 'Emphasis' },
  {
    tag: 'base · 14',
    size: '14px',
    sample: 'Chrome baseline — nav, buttons, body',
  },
  { tag: 'sm · 12', size: '12px', sample: 'Secondary — captions' },
  { tag: 'xs · 11', size: '11px', sample: 'Eyebrow labels' },
]

export default defineCases(
  'TypeScale',
  {
    Scale: () => <TypeScale steps={scale} />,
  },
  { level: 'molecule' },
)
