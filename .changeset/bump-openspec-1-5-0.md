---
"@awarebydefault/display-case": patch
---

Bump the `@fission-ai/openspec` dev dependency from 1.4.1 to 1.5.0. This is the
spec-authoring CLI used by the repo's OpenSpec workflow; it is not part of the
published runtime. The 1.5.0 release adds the early-beta "stores" model and fixes
config JSON-container parsing and carriage-return escaping in generated YAML
frontmatter. The repo's existing workspace-based OpenSpec setup continues to
validate cleanly against 1.5.0.
