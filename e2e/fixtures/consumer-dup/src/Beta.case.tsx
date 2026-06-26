import { defineCases } from '@awarebydefault/display-case'
import Markdown from 'markdown-to-jsx'

/** A second component inlining the same library, so it is duplicated across two
 *  per-component bundles — the report should flag it. */
export default defineCases(
  'Beta',
  {
    Default: () => <Markdown>{'# Beta\n\nAlso inlined.'}</Markdown>,
  },
  { level: 'atom' },
)
