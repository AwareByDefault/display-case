import { defineCases } from '@awarebydefault/display-case'
import Markdown from 'markdown-to-jsx'

/** A component that renders markdown via the shared `markdown-to-jsx` runtime. */
export default defineCases(
  'Alpha',
  {
    Default: () => <Markdown>{'# Alpha\n\nShared markdown runtime.'}</Markdown>,
  },
  { level: 'atom' },
)
