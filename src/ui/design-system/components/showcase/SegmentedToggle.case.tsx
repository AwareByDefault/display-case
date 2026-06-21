import { defineCases, tweak } from 'display-case'
import { useState } from 'react'
import { type SegmentedOption, SegmentedToggle } from './SegmentedToggle'

const two: SegmentedOption<string>[] = [
  { id: 'primer', label: 'Primer' },
  { id: 'library', label: 'Cases' },
]

const three: SegmentedOption<string>[] = [
  { id: 'light', label: 'Light' },
  { id: 'auto', label: 'Auto' },
  { id: 'dark', label: 'Dark' },
]

const five: SegmentedOption<string>[] = [
  { id: 'xs', label: 'XS' },
  { id: 'sm', label: 'SM' },
  { id: 'md', label: 'MD' },
  { id: 'lg', label: 'LG' },
  { id: 'xl', label: 'XL' },
]

// SegmentedToggle is controlled, so each specimen owns its selected value —
// click a segment in the stage and the thumb lerps to it, no tweaks needed.
function Demo({
  label,
  options,
  initial,
}: {
  label: string
  options: SegmentedOption<string>[]
  initial: string
}) {
  const [value, setValue] = useState(initial)
  return (
    <SegmentedToggle
      label={label}
      options={options}
      value={value}
      onChange={setValue}
    />
  )
}

export default defineCases(
  'SegmentedToggle',
  {
    // The browse chrome swaps cases *in place* (one persistent render root), so a
    // bare <Demo> would be reconciled as the same instance across cases and keep
    // its stale `value` — which, between cases with different option ids, leaves
    // no segment active. A distinct `key` per case forces a remount so each
    // re-seeds from its own `initial`. (Same reason the Playground keys by count.)
    Playground: {
      tweaks: {
        count: tweak.choice(['2', '3', '5'], '5'),
      },
      render: (t) => {
        const byCount: Record<string, SegmentedOption<string>[]> = {
          '2': two,
          '3': three,
          '5': five,
        }
        const options = byCount[t.count] ?? five
        return (
          <Demo
            key={`pg-${t.count}`}
            label="Size"
            options={options}
            initial={options[0].id}
          />
        )
      },
    },
    Two: () => (
      <Demo key="two" label="View mode" options={two} initial="library" />
    ),
    Three: () => (
      <Demo key="three" label="Theme" options={three} initial="auto" />
    ),
    Five: () => <Demo key="five" label="Size" options={five} initial="lg" />,
  },
  { level: 'molecule' },
)
