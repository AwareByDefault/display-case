import { defineCases } from '@awarebydefault/display-case'
import { InteractiveShell, makeModel, RealPrimer } from './shell-fixtures'

/**
 * The Primer *page*: the Primer template filled with the real reading page —
 * actual prose and live {@link Display} specimens rendered into the host. This
 * is what the Primer template becomes once a consumer authors its `.mdx`.
 */
export default defineCases(
  'Primer page',
  {
    Default: () => (
      <InteractiveShell
        {...makeModel({ mode: 'primer', shownMode: 'primer' })}
        renderFrame={null}
        primerFrame={<RealPrimer />}
      />
    ),
  },
  { level: 'page' },
)
