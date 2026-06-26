import { defineCases, tweak } from '@awarebydefault/display-case'
import { IconButton } from './IconButton'

export default defineCases(
  'IconButton',
  {
    Playground: {
      tweaks: {
        glyph: tweak.text('✕'),
        label: tweak.text('Close'),
        size: tweak.choice(['sm', 'md', 'lg'], 'md'),
        variant: tweak.choice(['outline', 'bare'], 'outline'),
        active: tweak.boolean(false),
        disabled: tweak.boolean(false),
      },
      render: (t) => (
        <IconButton
          glyph={t.glyph}
          label={t.label ?? 'Close'}
          size={t.size ?? 'md'}
          variant={t.variant ?? 'outline'}
          active={t.active}
          disabled={t.disabled}
        />
      ),
    },
    Glyphs: () => (
      <div style={{ display: 'flex', gap: 8 }}>
        <IconButton glyph="☰" label="Toggle navigation" />
        <IconButton glyph="⟲" label="Rotate" />
        <IconButton glyph="✕" label="Close" />
        <IconButton glyph="＋" label="Zoom in" />
      </div>
    ),
    Sizes: () => (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <IconButton glyph="✕" label="Small" size="sm" />
        <IconButton glyph="✕" label="Medium" size="md" />
        <IconButton glyph="✕" label="Large" size="lg" />
      </div>
    ),
    States: () => (
      <div style={{ display: 'flex', gap: 8 }}>
        <IconButton glyph="⬓" label="Default" />
        <IconButton glyph="▭" label="Active" active />
        <IconButton glyph="▭" label="Bare" variant="bare" />
        <IconButton glyph="✕" label="Disabled" disabled />
      </div>
    ),
  },
  { level: 'atom' },
)
