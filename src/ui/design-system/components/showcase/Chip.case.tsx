import { defineCases, tweak } from 'display-case'
import { Chip } from './Chip'

export default defineCases(
  'Chip',
  {
    Playground: {
      tweaks: {
        label: tweak.text('atom'),
        variant: tweak.choice(['default', 'accent', 'solid'], 'default'),
        current: tweak.boolean(false),
        withIndex: tweak.boolean(false),
        index: tweak.number(1),
        clickable: tweak.boolean(false),
      },
      render: (t) => (
        <Chip
          variant={t.variant as 'default' | 'accent' | 'solid'}
          current={t.current}
          index={t.withIndex ? t.index : undefined}
          onClick={t.clickable ? () => {} : undefined}>
          {t.label}
        </Chip>
      ),
    },
    Variants: () => (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Chip>atom</Chip>
        <Chip variant="accent">accent</Chip>
        <Chip variant="solid">solid</Chip>
      </div>
    ),
    Steps: () => (
      <div style={{ display: 'flex', gap: 8 }}>
        <Chip index={1} onClick={() => {}}>
          Request link
        </Chip>
        <Chip index={2} current onClick={() => {}}>
          Check email
        </Chip>
        <Chip index={3} onClick={() => {}}>
          Signed in
        </Chip>
      </div>
    ),
  },
  { level: 'atom' },
)
