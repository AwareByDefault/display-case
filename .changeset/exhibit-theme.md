---
"@awarebydefault/display-case": patch
---

Fix the dogfooded template, page, and flow exhibits (the chrome cased as
`ShellView`) so they follow the harness light/dark theme instead of always
rendering light. The exhibits now read the active `?theme=` from the document
root and re-theme with the rest of the showcase.
