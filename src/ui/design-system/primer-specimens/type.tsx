/**
 * Type specimens for Display Case's own Primer — the two-family pairing (Hanken
 * Grotesk for chrome, JetBrains Mono for developer texture), the dense px-based
 * size scale, and the three weights plus the signature uppercase eyebrow label.
 *
 * Thin wrappers over the reusable {@link FontFamilies}/{@link TypeScale}/
 * {@link WeightSpecimen} primitives (under `components/primer-specimen/`); the
 * Display-Case-specific data lives here.
 */
import { Eyebrow } from '../components'
import {
  type FontFamily,
  FontFamilies as SpecimenFontFamilies,
  TypeScale as SpecimenTypeScale,
  type TypeStep,
  type WeightSpec,
  WeightSpecimen,
} from '../components/primer-specimen'

const FAMILIES: FontFamily[] = [
  {
    tag: 'Sans · UI',
    sample: 'Display Case shows the work, not itself',
    note: 'Hanken Grotesk, ui-sans-serif, system-ui, "Segoe UI", Roboto…',
  },
  {
    tag: 'Mono · Code',
    sample: '/render/<component>/<case>?theme=dark',
    note: 'JetBrains Mono, ui-monospace, "SF Mono", Menlo…',
    mono: true,
  },
]

const SCALE: TypeStep[] = [
  { tag: 'xl · 28', size: '28px', sample: 'Doc heading' },
  { tag: 'lg · 20', size: '20px', sample: 'Section title' },
  { tag: 'md · 16', size: '16px', sample: 'Icon glyph / emphasis' },
  {
    tag: 'base · 14',
    size: '14px',
    sample: 'Chrome baseline — nav, buttons, body',
  },
  { tag: 'sm · 12', size: '12px', sample: 'Secondary — zoom %, captions' },
  { tag: 'xs · 11', size: '11px', sample: 'Eyebrow labels, dimension hints' },
]

const WEIGHTS: WeightSpec[] = [
  { weight: 400, name: 'Normal', role: 'body' },
  { weight: 500, name: 'Medium', role: 'active' },
  { weight: 600, name: 'Semibold', role: 'titles' },
]

export function FontFamilies() {
  return <SpecimenFontFamilies families={FAMILIES} />
}

export function TypeScale() {
  return <SpecimenTypeScale steps={SCALE} />
}

export function Weights() {
  return (
    <WeightSpecimen
      weights={WEIGHTS}
      footer={
        <>
          <div className="dcpl-divider" />
          <Eyebrow>
            Components · group label · 11px / 500 / 0.08em uppercase
          </Eyebrow>
        </>
      }
    />
  )
}
