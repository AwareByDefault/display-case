import { defineCases } from '@awarebydefault/display-case'
import Markdown from 'markdown-to-jsx'

/** Imports `markdown-to-jsx` without it being declared `share`, so it inlines. */
export default defineCases(
  'Alpha',
  {
    Default: () => <Markdown>{'# Alpha\n\nInlined markdown.'}</Markdown>,
  },
  { level: 'atom' },
)
