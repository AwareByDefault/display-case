import { defineCases, tweak } from '@awarebydefault/display-case'

/**
 * Two tweaked cases for the auto-undock spec: `Short` fits beside a docked
 * tweaks panel, `Tall` is far taller than the stage so a docked panel would
 * push it out of view (the chrome should float the panel by default). Both
 * declare a tweak so the controls panel is present. Fixed pixel heights keep the
 * docked-vs-floating decision deterministic across viewports.
 */
export default defineCases(
  'Sizes',
  {
    Short: {
      tweaks: { label: tweak.text('short') },
      render: (t) => (
        <div style={{ width: 240, height: 40 }} data-label={t.label} />
      ),
    },
    Tall: {
      tweaks: { label: tweak.text('tall') },
      render: (t) => (
        <div style={{ width: 240, height: 2000 }} data-label={t.label} />
      ),
    },
  },
  { level: 'atom' },
)
