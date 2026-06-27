---
"@awarebydefault/display-case": patch
---

Themed render documents now declare a CSS `color-scheme` matching the requested
theme, so user-agent-rendered surfaces (scrollbars, default form-control and
`<button>` chrome) follow the theme instead of rendering in their light defaults.
Previously a dark-themed preview kept light user-agent controls — most visibly a
bare `<button>` showing the light `ButtonFace` background — which skewed dark
snapshots and produced misleading `color-contrast` results against light control
surfaces. The client keeps the color scheme matched across in-place theme swaps.
