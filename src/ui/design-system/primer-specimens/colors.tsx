/**
 * Colour specimens for Display Case's own Primer — the marigold accent ramp,
 * the warm paper neutral ramp, the semantic role swatches (which re-paint under
 * a forced `data-theme` scope), and the status hues reserved for check output.
 *
 * These are thin, document-specific wrappers: the Display-Case-specific data
 * lives here, and the reusable {@link ColorRamp}/{@link SwatchGrid}/
 * {@link StatusList} primitives (under `components/primer-specimen/`) do the
 * rendering. Each chip references its `--dc-*` custom property as a complete
 * literal (`var(--dc-marigold-600)`) so the swatches track the live theme *and*
 * the token-conformance check can statically resolve every reference (a
 * templated `var(--dc-${name})` cannot be resolved, so the full string is stored
 * in the data).
 */
import {
  ColorRamp,
  type ColorStop,
  type StatusItem,
  StatusList,
  type Swatch,
  SwatchGrid,
} from '../components/primer-specimen'

const MARIGOLD: ColorStop[] = [
  { name: 'marigold-200', color: 'var(--dc-marigold-200)', caption: '#fbe3bb' },
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

const PAPER: ColorStop[] = [
  { name: 'paper-50', color: 'var(--dc-paper-50)', caption: '#fbfaf6' },
  { name: 'paper-100', color: 'var(--dc-paper-100)', caption: '#f4f1e9' },
  { name: 'paper-200', color: 'var(--dc-paper-200)', caption: '#e6e0d4' },
  { name: 'paper-300', color: 'var(--dc-paper-300)', caption: '#d6cebe' },
  { name: 'paper-400', color: 'var(--dc-paper-400)', caption: '#b3a896' },
  { name: 'paper-500', color: 'var(--dc-paper-500)', caption: '#8a8073' },
  { name: 'paper-600', color: 'var(--dc-paper-600)', caption: '#6b6259' },
  { name: 'paper-700', color: 'var(--dc-paper-700)', caption: '#4a423a' },
  { name: 'paper-800', color: 'var(--dc-paper-800)', caption: '#2e2822' },
  { name: 'paper-900', color: 'var(--dc-paper-900)', caption: '#211d18' },
  { name: 'paper-950', color: 'var(--dc-paper-950)', caption: '#15110d' },
]

const SEMANTIC: Swatch[] = [
  { color: 'var(--dc-bg)', token: 'bg', role: 'canvas' },
  { color: 'var(--dc-bg-subtle)', token: 'bg-subtle', role: 'sidebar' },
  { color: 'var(--dc-surface)', token: 'surface', role: 'inputs' },
  { color: 'var(--dc-border)', token: 'border', role: 'hairline' },
  { color: 'var(--dc-fg)', token: 'fg', role: 'text' },
  { color: 'var(--dc-fg-muted)', token: 'fg-muted', role: 'labels' },
  { color: 'var(--dc-brand)', token: 'brand', role: 'accent' },
  { color: 'var(--dc-brand-subtle)', token: 'brand-subtle', role: 'wash' },
]

const STATUS: StatusItem[] = [
  { color: 'var(--dc-success)', name: 'success', caption: 'green-600' },
  { color: 'var(--dc-warning)', name: 'warning', caption: 'amber-500' },
  { color: 'var(--dc-danger)', name: 'danger', caption: 'red-600' },
]

export function MarigoldRamp() {
  return <ColorRamp stops={MARIGOLD} chipHeight={56} />
}

export function PaperRamp() {
  return <ColorRamp stops={PAPER} chipHeight={48} />
}

export function SemanticSwatches() {
  return <SwatchGrid swatches={SEMANTIC} columns={4} />
}

export function StatusHues() {
  return <StatusList items={STATUS} />
}
