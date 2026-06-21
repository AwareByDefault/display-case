# Tasks — display-case-rename-primer-and-placard

## 1. Rename the collection surface: placard → primer

- [x] 1.1 Rename source files: `ssr-placard.tsx` → `ssr-primer.tsx`, `ui/placard-mount.tsx` → `ui/primer-mount.tsx`, `ui/placard.tsx` → `ui/primer.tsx`, the `placard.mdx` documents, and the `PlacardPage`/`PlacardTemplate` case + doc siblings.
- [x] 1.2 Rename the specimen directories: `components/placard-specimen/` → `primer-specimen/`, `design-system/placard-specimens/` → `primer-specimens/`.
- [x] 1.3 Replace identifiers and strings case-sensitively (`Placard`→`Primer`, `placard`→`primer`): components (`PlacardRoot` …), types (`PlacardSection`/`PlacardGroup`), CSS (`.dc-placard*`), routes (`/placard`, `/render/placard`), the `dc-placard-*` postMessage protocol, config key + `landing` value, state vars, and the `placard-present-and-used` structure rule.
- [x] 1.4 Update the live spec `openspec/specs/display-case/spec.md`: "Authored placard" → "Authored primer", "Placard presence and use" → "Primer presence and use", and placard wording in "Pre-scripting rendered content" and "Live authoring updates".

## 2. Rename the per-component sibling: *.prompt.md → *.placard.md

- [x] 2.1 Rename the 68 authored component doc siblings `<component>.prompt.md` → `<component>.placard.md` (excluding `.github/prompts/*` and `display-case.prompt.md`).
- [x] 2.2 Update discovery/manifest: the `.case.tsx → .placard.md` path resolution (`server.ts`, `structure-check.ts`), the manifest field `promptDoc` → `placardDoc`, the watch pattern, and internal vars (`promptById`/`promptAbs`/`promptGlobs`).
- [x] 2.3 Rename the structure rules and markers: `case-prompt-coverage` → `case-placard-coverage`, `no-orphaned-prompt-doc` → `no-orphaned-placard-doc`, `no-prompt` → `no-placard`, and the `allow-*` waivers.
- [x] 2.4 Rename the authoring guide `writing-prompt-docs.md` → `writing-placard-docs.md` and the authoring skill `display-case-author-prompt-doc` → `display-case-author-placard-doc` (package source + scaffolded `.claude/skills/` copy), updating their content.
- [x] 2.5 Update the agent guide `display-case.prompt.md` content (the file keeps its name): `<component>.placard.md` sibling reference and the `placardDoc` manifest field.
- [x] 2.6 Update `AGENTS.md` (symlinked from `CLAUDE.md`) and `docs/NOTES.md` references to both conventions.

## 3. Latent defect

- [x] 3.1 Replace the raw NUL-byte composite-key delimiters in `ui/shell-core.ts` with the `\0` escape so git no longer treats the source as binary; confirm the key still contains U+0000 separators at runtime.

## 4. Verification

- [x] 4.1 `bun test packages/display-case/src` — 161 pass, 0 fail.
- [x] 4.2 `display-case check packages/display-case` — a11y/visual/tokens/ssr/structure clean (35 components, 104 cases).
- [x] 4.3 `display-case check packages/ui` — a11y/visual/tokens/ssr clean; the 2 `interactive-cases-keyed` structure findings are pre-existing and unrelated to this rename.
- [x] 4.4 Confirm no `placard` token remains outside frozen archives, and no convention identifier (`promptDoc`, `case-prompt-coverage`, …) remains outside the protected `display-case.prompt.md` / `.github/prompts/` files.

## 5. Documentation

- [x] 5.1 Record in `docs/NOTES.md`: the primer/placard naming rationale and the NUL-byte-makes-git-think-binary trap (so a future bulk rename does not silently skip such files).
