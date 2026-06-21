/**
 * Spacing specimens for Display Case's own Primer — the tight rem-based spacing
 * scale, the modest corner radii, and the flat, border-led elevation model
 * (shadow is reserved for genuinely floating layers).
 *
 * Thin wrappers over the reusable {@link SpacingScale}/{@link SpecimenBoxRow}
 * primitives (under `components/primer-specimen/`); the Display-Case-specific
 * data lives here.
 */
import {
  type BoxSpec,
  type SpaceStep,
  SpecimenBoxRow,
  SpacingScale as SpecimenSpacingScale,
} from '../components/primer-specimen'

const SPACE: SpaceStep[] = [
  { token: 'space-1', value: '2px', width: 2 },
  { token: 'space-2', value: '4px', width: 4 },
  { token: 'space-3', value: '6px', width: 6 },
  { token: 'space-4', value: '8px', width: 8 },
  { token: 'space-6', value: '12px', width: 12 },
  { token: 'space-8', value: '16px', width: 16 },
  { token: 'space-10', value: '20px', width: 20 },
  { token: 'space-16', value: '32px', width: 32 },
]

const RADII: BoxSpec[] = [
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
    label: 'lg',
    note: '12px · overlays',
    boxStyle: { borderRadius: 'var(--dc-radius-lg)' },
  },
  {
    label: 'full',
    note: 'pills · dots',
    boxStyle: { borderRadius: 'var(--dc-radius-full)', width: '48px' },
  },
]

// The elevation boxes share a wider surface-on-shadow shape; only the border /
// shadow differs per item.
const elevBox = (extra: BoxSpec['boxStyle']): BoxSpec['boxStyle'] => ({
  width: '134px',
  height: '56px',
  background: 'var(--dc-surface)',
  borderRadius: 'var(--dc-radius-md)',
  ...extra,
})

const ELEVATION: BoxSpec[] = [
  {
    note: 'border-line',
    content: '1px border',
    boxStyle: elevBox({ border: 'var(--dc-border-line)' }),
  },
  {
    note: 'border-strong',
    content: 'strong',
    boxStyle: elevBox({ border: '1px solid var(--dc-border-strong)' }),
  },
  {
    note: 'rare — hairline lift',
    content: 'shadow-sm',
    boxStyle: elevBox({
      border: 'var(--dc-border-line)',
      boxShadow: 'var(--dc-shadow-sm)',
    }),
  },
  {
    note: 'menus / popovers only',
    content: 'overlay',
    boxStyle: elevBox({
      border: 'var(--dc-border-line)',
      boxShadow: 'var(--dc-shadow-overlay)',
    }),
  },
]

export function SpacingScale() {
  return <SpecimenSpacingScale steps={SPACE} />
}

export function RadiusRow() {
  return <SpecimenBoxRow items={RADII} />
}

export function ElevationRow() {
  return <SpecimenBoxRow items={ELEVATION} />
}
