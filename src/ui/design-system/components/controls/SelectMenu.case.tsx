import { defineCases, tweak } from '@awarebydefault/display-case'
import { useState } from 'react'
import { SelectMenu, type SelectMenuOption } from './SelectMenu'

const FRUITS = ['Apple', 'Banana', 'Cherry', 'Date', 'Elderberry']

// Disabled options stand in as non-interactive group headers (the chrome's
// screen-size picker uses this for its Responsive / Devices groups).
const GROUPED: SelectMenuOption[] = [
  { value: '__responsive', label: 'Responsive', disabled: true },
  { value: 'full', label: 'Full' },
  { value: 'desktop', label: 'Desktop' },
  { value: '__devices', label: 'Devices', disabled: true },
  { value: 'ipad', label: 'iPad' },
  { value: 'iphone', label: 'iPhone' },
]

// SelectMenu is controlled, so each specimen owns its selected value. The open
// menu is an out-of-flow popup, so the specimen reserves height for it — the
// stage hugs a component's natural box and would otherwise clip the menu (same
// reason the floating TweaksPanel specimen reserves a sized surface).
function Demo({
  options,
  initial,
  size,
  disabled,
}: {
  options: SelectMenuOption[]
  initial: string
  size?: 'sm' | 'md'
  disabled?: boolean
}) {
  const [value, setValue] = useState(initial)
  return (
    <div
      style={{
        width: '14rem',
        minHeight: '12rem',
        display: 'flex',
        alignItems: 'flex-start',
      }}>
      <SelectMenu
        aria-label="Demo select"
        options={options}
        value={value}
        onChange={setValue}
        size={size}
        disabled={disabled}
      />
    </div>
  )
}

export default defineCases(
  'SelectMenu',
  {
    Playground: {
      tweaks: {
        // The values to choose between — edit the comma-separated list to change
        // the menu's options live.
        options: tweak.text('Apple, Banana, Cherry, Date, Elderberry'),
        // The selected value (any of the options above); you can also open the
        // menu and pick in the stage.
        value: tweak.text('Cherry'),
        size: tweak.choice(['sm', 'md'], 'md'),
        disabled: tweak.boolean(false),
      },
      // Re-seed when the options or starting value change; size/disabled flow in
      // as props (no remount, so an in-stage pick survives toggling them).
      render: (t) => {
        const options = (t.options ?? '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
        return (
          <Demo
            key={`${t.options}|${t.value}`}
            options={options}
            initial={t.value ?? 'Cherry'}
            size={t.size ?? 'md'}
            disabled={t.disabled}
          />
        )
      },
    },
    // Distinct `key` per case: the browse chrome swaps cases in place, so an
    // unkeyed <Demo> would keep the previous case's selected value (and `Grouped`
    // uses a different option set entirely) — see docs/writing-cases.md.
    Default: () => <Demo key="default" options={FRUITS} initial="Cherry" />,
    Small: () => (
      <Demo key="small" options={FRUITS} initial="Apple" size="sm" />
    ),
    Disabled: () => (
      <Demo key="disabled" options={FRUITS} initial="Banana" disabled />
    ),
    // Open the menu in the stage to see the group headers.
    Grouped: () => <Demo key="grouped" options={GROUPED} initial="desktop" />,
  },
  { level: 'atom' },
)
