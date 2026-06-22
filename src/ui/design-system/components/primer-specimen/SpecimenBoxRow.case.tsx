import { defineCases } from '@awarebydefault/display-case'
import { type BoxSpec, SpecimenBoxRow } from './SpecimenBoxRow'

const radii: BoxSpec[] = [
  { label: 'none', note: '0', boxStyle: { borderRadius: '0' } },
  {
    label: 'sm',
    note: '5px · controls',
    boxStyle: { borderRadius: 'var(--dc-radius-sm)' },
  },
  {
    label: 'md',
    note: '8px · panels',
    boxStyle: { borderRadius: 'var(--dc-radius-md)' },
  },
  {
    label: 'full',
    note: 'pills · dots',
    boxStyle: { borderRadius: 'var(--dc-radius-full)', width: '48px' },
  },
]

const elevation: BoxSpec[] = [
  {
    note: 'border-line',
    content: '1px border',
    boxStyle: {
      width: '134px',
      height: '56px',
      background: 'var(--dc-surface)',
      borderRadius: 'var(--dc-radius-md)',
      border: 'var(--dc-border-line)',
    },
  },
  {
    note: 'menus / popovers only',
    content: 'overlay',
    boxStyle: {
      width: '134px',
      height: '56px',
      background: 'var(--dc-surface)',
      borderRadius: 'var(--dc-radius-md)',
      border: 'var(--dc-border-line)',
      boxShadow: 'var(--dc-shadow-overlay)',
    },
  },
]

export default defineCases(
  'SpecimenBoxRow',
  {
    Radius: () => <SpecimenBoxRow items={radii} />,
    Elevation: () => <SpecimenBoxRow items={elevation} />,
  },
  { level: 'molecule' },
)
