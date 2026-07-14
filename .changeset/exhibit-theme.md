---
'@awarebydefault/display-case': patch
---

Fix the dogfooded template, page, and flow exhibits (Display Case's own browse
chrome, cased for dogfooding) so they follow the harness light/dark theme instead
of always rendering light. The shipped shell gains an opt-in `inheritTheme` prop
that makes `.dc-app` inherit the document root's `data-theme` instead of declaring
its own scope; it is off by default, so the live browse chrome renders exactly as
it did before.
