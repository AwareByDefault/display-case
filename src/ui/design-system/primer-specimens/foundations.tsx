/**
 * Visual-foundation & content specimens for Display Case's own Primer — the
 * content-voice definition list, the live interaction-states row, and the
 * three-region layout mock.
 *
 * The definition list and layout mock are thin wrappers over the reusable
 * {@link DefinitionList}/{@link LayoutMock} primitives (under
 * `components/primer-specimen/`). The states row is built from the system's own
 * components, so it tracks the live theme.
 */
import { Button, Chip, Input } from '../components'
import {
  type DefEntry,
  DefinitionList,
  LayoutMock as SpecimenLayoutMock,
} from '../components/primer-specimen'

const FUNDAMENTALS: DefEntry[] = [
  {
    term: 'Voice',
    description:
      'Plain, confident, technical-but-warm. It explains why, briefly, then moves on — like a thoughtful README from an engineer who respects your time.',
  },
  {
    term: 'Person',
    description:
      'Addresses you. Refers to itself as Display Case or it — never we in UI copy.',
  },
  {
    term: 'Casing',
    description:
      'Sentence case everywhere. The one exception is the eyebrow label: UPPERCASE mono with wide tracking.',
  },
  {
    term: 'Length',
    description:
      'Terse. Buttons are one or two words; labels are a single token, often the literal prop name in mono.',
  },
  {
    term: 'Numbers',
    description:
      'Shown in mono, exact, no fuss — 1280 × 800, 100%, /render/button/playground.',
  },
  { term: 'Emoji', description: "Not used in the UI. Don't reach for them." },
]

export function DefList() {
  return <DefinitionList entries={FUNDAMENTALS} />
}

export function StatesRow() {
  return (
    <div className="dcpl-row">
      <Button>Default</Button>
      <Button variant="accent">Selected</Button>
      <Chip current>active case</Chip>
      <Input placeholder="focus me" style={{ width: '9rem' }} />
      <Button disabled>Disabled</Button>
    </div>
  )
}

export function LayoutMock() {
  return (
    <SpecimenLayoutMock
      header="header"
      sidebar="sidebar"
      main="main · the stage"
    />
  )
}
