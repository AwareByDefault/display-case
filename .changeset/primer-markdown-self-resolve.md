---
"@awarebydefault/display-case": patch
---

Compile a consumer's Markdown/MDX primer against Display Case's own copy of
`markdown-to-jsx`. The compiled primer is loaded from inside the consumer's tree,
so the previously-emitted bare `import 'markdown-to-jsx'` resolved from the
consumer — failing with `Could not resolve "markdown-to-jsx"` unless the consumer
redeclared the dep. The plugin now resolves the package from Display Case's own
install and emits an absolute path, so authoring a `primer.md`/`primer.mdx` no
longer requires the consumer to add `markdown-to-jsx`.
