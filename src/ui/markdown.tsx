import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Renders a component's authored `.placard.md` as full CommonMark + GFM. Raw HTML
 * is intentionally NOT enabled (react-markdown's default), so a doc file can't
 * inject markup into the chrome. Syntax highlighting is a deliberate non-goal
 * for now — fenced code renders as plain styled <pre><code>.
 */
export function DocMarkdown({ source }: { source: string }) {
  return (
    <div className="dc-doc-md">
      <Markdown remarkPlugins={[remarkGfm]}>{source}</Markdown>
    </div>
  )
}
