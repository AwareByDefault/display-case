---
"@awarebydefault/display-case": minor
---

Add a `theme` config option that drives a configurable set of document-root theme
signals, so showcased components following any common light/dark convention
re-theme with the preview toggle. Display Case still always emits `data-theme` +
`color-scheme`; the default now also toggles a `dark` class (Tailwind / shadcn /
next-themes / VueUse / Nuxt), and `theme.signals` opts into Bootstrap
(`data-bs-theme`), Material UI (`data-mui-color-scheme`), and custom
attribute/class mappings. The signals are applied identically before scripting and
across an interactive toggle (no flash), and the snapshot/audit toolchain emulates
`prefers-color-scheme` so media-query-only components are captured in the right
theme.
