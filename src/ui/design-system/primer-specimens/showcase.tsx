/**
 * Interactive showcase specimens for Display Case's own Primer. These wrap
 * stateful behaviour the MDX can't express inline: the FlowNav stepper (tracks
 * the active step) and the TweaksPanel demo.
 *
 * The render-address bar is the reusable {@link RenderAddress} showcase
 * component (under `components/showcase/`); this module just supplies Display
 * Case's default URL.
 */
import { useState } from 'react'
import {
  FlowNav,
  Input,
  Select,
  RenderAddress as SpecimenRenderAddress,
  TweaksPanel,
} from '../components'

const FLOW_STEPS = [
  { id: 'Request link', label: 'Request link' },
  { id: 'Check email', label: 'Check email' },
  { id: 'Signed in', label: 'Signed in' },
]

export function FlowNavDemo() {
  const [active, setActive] = useState('Check email')
  return (
    <div className="dcpl-block">
      <FlowNav steps={FLOW_STEPS} activeId={active} onSelect={setActive} />
    </div>
  )
}

export function TweaksPanelDemo() {
  const items = [
    {
      label: 'label',
      control: (
        <Input size="sm" defaultValue="Snapshot" style={{ width: '8rem' }} />
      ),
    },
    {
      label: 'variant',
      control: <Select size="sm" options={['ghost', 'accent']} />,
    },
    {
      label: 'disabled',
      control: <input type="checkbox" aria-label="disabled" />,
    },
  ]
  return (
    <div style={{ width: '100%', maxWidth: '24rem', margin: '0 auto' }}>
      <TweaksPanel
        url="?t.variant=accent"
        items={items}
        onToggleMode={() => {}}
      />
    </div>
  )
}

export function RenderAddress({
  url = '/render/button/playground?theme=light&t.variant=accent',
}: {
  url?: string
}) {
  return <SpecimenRenderAddress url={url} />
}
