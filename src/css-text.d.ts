/**
 * `*.css` imported with the `text` attribute resolves to the file's contents as
 * a string (Bun's text loader). Used by the chrome to inline its own layout CSS
 * via `injectStyle`, so the chrome paints correctly inside the isolated /render
 * document (which doesn't link `chrome.css`) — the same self-contained pattern
 * the design-system components use for their CSS.
 */
declare module '*.css' {
  const content: string
  export default content
}
