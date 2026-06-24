import { defineFlow } from '@awarebydefault/display-case'
import { Button } from '..'
import { ShellView } from './ShellView'
import { makeModel, RealPrimer, StageSlot } from './shell-fixtures'

/**
 * The headline dogfood: Display Case's own Primer ↔ Cases view change, exhibited
 * as a flow. Each step is the pure {@link ShellView} fed a static model — the
 * Primer step shows the reading page, the Cases step shows the library — and the
 * sidebar's mode switch is wired to the flow's `goto`, so clicking it walks the
 * flow exactly as it walks the live chrome.
 */
export default defineFlow('Primer to Cases', {
  // Explicit IA group (overrides the `shell` folder derivation) — nests this flow
  // under a Walkthroughs sub-group in the Exhibits tree; dogfoods `meta.group`.
  group: 'Shell/Walkthroughs',
  steps: {
    'Primer view': {
      transitions: ['Cases view'],
      render: ({ goto }) => (
        <ShellView
          {...makeModel({
            mode: 'primer',
            shownMode: 'primer',
            setMode: (m) => {
              if (m !== 'primer') goto('Cases view')
            },
          })}
          renderFrame={null}
          primerFrame={<RealPrimer />}
        />
      ),
    },
    'Cases view': {
      transitions: ['Primer view'],
      render: ({ goto }) => (
        <ShellView
          {...makeModel({
            mode: 'components',
            shownMode: 'components',
            boxW: 240,
            boxH: 120,
            setMode: (m) => {
              if (m === 'primer') goto('Primer view')
            },
          })}
          renderFrame={
            <StageSlot>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button>Save changes</Button>
                <Button variant="accent">Publish</Button>
              </div>
            </StageSlot>
          }
          primerFrame={null}
        />
      ),
    },
  },
})
