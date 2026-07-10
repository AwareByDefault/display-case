---
---

Dogfood-only fix: the shell page/template/flow cases now render through an
`InteractiveShell` wrapper so the chrome's ☰ nav toggle actually works in the
showcase (it was wired to a no-op model, which hid the page at mobile widths).
No change to the published surface.
