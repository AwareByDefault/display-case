---
"@awarebydefault/display-case": minor
---

Humanize tweak control labels in the browse chrome: a tweak key is split on camelCase and underscore boundaries (a clumped acronym stays intact) and its first word is capitalized, so `fontSize` shows as "Font Size" and `thisURLValue` as "This URL Value". The raw key still drives the render-argument property name and the `t.<name>` share-URL param — only the on-screen label (and the control's matching accessible name) changes.
