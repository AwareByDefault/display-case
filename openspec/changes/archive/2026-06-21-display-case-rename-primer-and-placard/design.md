# Design — display-case-rename-primer-and-placard

## Context

Two names had drifted from what they describe. The whole-collection reading surface was the "placard"; the per-component usage-doc sibling was `<component>.prompt.md`. The museum metaphor that Display Case already uses ("cases", "exhibits", "the showcase") makes the correct mapping obvious once stated: a placard is the label beside *one* exhibit, and a primer is the guide to the *whole* collection. The surfaces were named the wrong way round, and one of them (`*.prompt.md`) collided with an unrelated, established external convention.

## Goals

- Rename the whole-collection surface placard → primer everywhere it is named (routes, config, code, CSS, protocol, structure check, specimen dirs, docs, spec).
- Rename the per-component sibling convention `*.prompt.md` → `*.placard.md` everywhere the convention is named (files, discovery, manifest field, structure rules, markers, docs, authoring skill).
- Change no behavior. Every address except the one renamed route, every snapshot, every theme, and the specimen contract stay identical.

## Decisions

### "Primer" for the collection surface

Candidates considered: *catalogue*, *docent*, *companion*, *guide* (museum framing), then *preface*, *overture*, *brief* (introductory-reading framing). "Primer" won because it names the *function* — an introductory text that primes a reader before they explore the cases — rather than a museum fixture. Known minor caveat: GitHub's design system is also named "Primer"; within this repo the term is unambiguous.

### "Placard" for the per-component sibling

The sibling doc is a label beside one case — precisely a placard. Reusing the freed-up word keeps the metaphor tight (each case → a placard; the collection → a primer) and removes the false signal that `*.prompt.md` carried (Copilot/VS Code prompt files are invokable automations; these are passive docs).

### What is explicitly NOT renamed

- `.github/prompts/*.prompt.md` — genuine Copilot prompt files (the very convention whose name we are vacating). Left as-is.
- `packages/display-case/display-case.prompt.md` — the package's AI-agent integration prompt (scaffolded into consuming repos). It is an actual agent prompt, not a component placard, so it keeps the `.prompt.md` name. Its *content* references to the sibling convention and the manifest field were updated (`<component>.placard.md`, `placardDoc`).
- The generic `allow-orphan` marker — it is not specific to the extension.

### The rename was mechanical but case-aware

Identifiers carried two casings only (`placard`/`Placard`; the convention tokens are all lower/camel). Replacements were applied case-sensitively (`PLACARD`/`Placard`/`placard`) so `PlacardRoot` → `PrimerRoot`, `dc-placard-ready` → `dc-primer-ready`, etc. The `.prompt.md` extension token was replaced with a negative lookbehind guarding `display-case.prompt.md`, and in both plain (`prompt.md`) and regex-escaped (`prompt\.md`) forms so code regexes were caught too.

### Null-byte delimiter in `shell-core.ts`

`shell-core.ts` built a composite specimen key with two raw NUL bytes as separators (`${id}\0${id}\0…`). Raw NUL in a tracked source file makes git treat the file as binary, which silently excluded it from `grep -I`-based tooling (and from the first rename pass — it was caught only because a test failed on a dangling import). The raw bytes were replaced with the `\0` string escape: identical runtime value (the key still contains U+0000 separators), but the source is now plain text and participates in text tooling.

## Risks / Trade-offs

- **"Primer" / GitHub Primer overlap** — accepted; in-repo usage is unambiguous and no integration depends on the external name.
- **Churn across ~140 files** — mitigated by mechanical, verifiable replacement and by leaving archived changes frozen, so history stays readable.
- **Skill rename** — `display-case-author-placard-doc` changes a skill id; the scaffolded `.claude/skills/` copy was renamed in lock-step so the package source and the scaffolded artifact stay identical.

## Migration

No data or config migration is required of an existing consumer beyond the rename itself: a `display-case.config.ts` that set `placard:` now sets `primer:`, and any `*.prompt.md` sibling becomes `*.placard.md`. Both were updated in this repo's three consumers (`apps/web`, `apps/admin`, `packages/ui`).

## Future work (out of scope for this change)

- None. This change is self-contained; it neither adds nor removes behavior.
