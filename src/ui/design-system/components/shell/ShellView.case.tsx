import { defineFlow } from 'display-case'
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
  steps: {
    'Primer view': {
      transitions: ['Cases view'],
      render: ({ goto }) => (
        <ShellView
          {...makeModel({
            mode: 'primer',
            shownMode: 'primer',
            setMode: (m) => {
              if (m === 'library') goto('Cases view')
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
            mode: 'library',
            shownMode: 'library',
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
