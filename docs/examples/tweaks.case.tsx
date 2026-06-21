/**
 * Example: a case with tweaks.
 *
 * A tweaked case is an object with a `tweaks` schema and a `render` function
 * that receives the resolved values. Each tweak becomes an interactive control,
 * and its value is URL-encoded as `t.<name>` so the state is shareable and
 * snapshottable.
 *
 * Subject: `TweakControl`, Display Case's own atom — a single tweak input that
 * comes in text, choice, and boolean variants. Display Case dogfoods itself, so
 * its UI parts make good case subjects.
 *
 * See ../tweaks.md for the four control kinds and encoding rules.
 */
import { defineCases, tweak } from 'display-case'
import { TweakControl } from './tweak-control'

export default defineCases(
  'TweakControl',
  {
    Playground: {
      tweaks: {
        kind: tweak.choice(['text', 'choice', 'boolean'], 'text'),
        label: tweak.text('Save changes'),
        value: tweak.text('Save'),
        disabled: tweak.boolean(false),
      },
      render: (t) => (
        <TweakControl
          kind={t.kind as 'text' | 'choice' | 'boolean'}
          label={t.label}
          value={t.value}
          disabled={t.disabled}
        />
      ),
    },
  },
  { level: 'atom' },
)
