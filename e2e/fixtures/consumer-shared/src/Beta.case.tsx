import { defineCases } from '@awarebydefault/display-case'
import Markdown from 'markdown-to-jsx'

/** A second component importing the same shared `markdown-to-jsx` runtime, so the
 *  library is shared across more than one per-component bundle. */
export default defineCases(
  'Beta',
  {
    Default: () => <Markdown>{'# Beta\n\nAlso shared.'}</Markdown>,
  },
  { level: 'atom' },
)
