import Markdown from 'markdown-to-jsx'

/**
 * Renders a component's authored `.placard.md` as full CommonMark + GFM via
 * `markdown-to-jsx` — a ~zero-dependency renderer that emits React elements
 * (no `dangerouslySetInnerHTML`). Raw HTML is intentionally NOT rendered
 * (`disableParsingRawHTML`), so a doc file can't inject markup into the chrome.
 * Syntax highlighting is a deliberate non-goal — fenced code renders as plain
 * styled <pre><code>.
 */
const OPTIONS = { disableParsingRawHTML: true } as const

export function DocMarkdown({ source }: { source: string }) {
  return (
    <div className="dc-doc-md">
      <Markdown options={OPTIONS}>{source}</Markdown>
    </div>
  )
}
