import { defineCases } from '@awarebydefault/display-case'
import { ShellView } from './ShellView'
import { makeModel, PlaceholderPrimer } from './shell-fixtures'

/**
 * The Primer layout as a *template*: the chrome in reading mode — the mode
 * switch, the table-of-contents nav, and the reading host — wrapped around a
 * skeleton standing in for the long-form wall text and its specimens.
 */
export default defineCases(
  'Primer template',
  {
    Default: () => (
      <ShellView
        {...makeModel({ mode: 'primer', shownMode: 'primer' })}
        renderFrame={null}
        primerFrame={<PlaceholderPrimer />}
      />
    ),
  },
  { level: 'template' },
)
