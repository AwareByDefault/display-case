import { defineCases, tweak } from '@awarebydefault/display-case'
import { Input } from '../controls/Input'
import { Select } from '../controls/Select'
import { TweaksPanel } from './TweaksPanel'

const items = [
  {
    label: 'kind',
    control: (
      <Select
        aria-label="kind"
        size="sm"
        options={['text', 'number', 'boolean']}
        defaultValue="number"
      />
    ),
  },
  {
    label: 'label',
    control: <Input aria-label="label" size="sm" defaultValue="Save changes" />,
  },
  {
    label: 'disabled',
    control: <input type="checkbox" aria-label="disabled" />,
  },
]

export default defineCases(
  'TweaksPanel',
  {
    Playground: {
      tweaks: {
        title: tweak.text('Tweaks'),
        mode: tweak.choice(['docked', 'floating'], 'docked'),
        url: tweak.text('?t.kind=number&t.disabled=1'),
      },
      render: (t) => {
        const floating = t.mode === 'floating'
        const panel = (
          <TweaksPanel
            title={t.title || undefined}
            mode={t.mode as 'docked' | 'floating'}
            url={t.url || undefined}
            items={items}
            onToggleMode={() => {}}
          />
        )
        // Floating uses position:fixed. The `transform` makes this surface a
        // containing block, so the panel anchors to its corner (a stand-in for
        // the app viewport) instead of escaping the Stage's render frame. The
        // surface needs an explicit size — the panel is out-of-flow, so a
        // percentage width would collapse to zero.
        return floating ? (
          <div
            style={{
              position: 'relative',
              transform: 'translateZ(0)',
              width: '30rem',
              height: '18rem',
              border: '1px dashed var(--dc-border)',
              borderRadius: 'var(--dc-radius-md)',
            }}>
            {panel}
          </div>
        ) : (
          <div style={{ width: '26rem' }}>{panel}</div>
        )
      },
    },
    Docked: () => (
      <div style={{ width: '26rem' }}>
        <TweaksPanel
          url="?t.kind=number&t.disabled=1"
          items={items}
          onToggleMode={() => {}}
        />
      </div>
    ),
  },
  { level: 'molecule' },
)
