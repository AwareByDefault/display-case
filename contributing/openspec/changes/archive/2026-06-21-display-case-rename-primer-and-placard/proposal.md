## Why

Display Case borrowed two names that, on reflection, point at the wrong things.

**"Placard" was attached to the whole-collection reading surface.** In a museum a *placard* is the small label beside a single exhibit — not the guide to the entire show. The surface Display Case called the "placard" is the opposite scale: one long-form document that introduces the whole component collection and primes a reader before they explore the individual cases. The right word for that is a **primer**.

**The per-component documentation sibling was named `<component>.prompt.md`.** That extension is already an established external convention — GitHub Copilot / VS Code "prompt files" are invokable `*.prompt.md` task automations with their own frontmatter and `/`-invocation. Our files are nothing of the sort: they are passive usage docs rendered in a panel beside one component. By the museum metaphor they are exactly *placards* — a label beside one case. Naming them `<component>.placard.md` makes the metaphor consistent: each case gets a **placard**; the whole collection gets a **primer**.

This change realigns both names. It is a pure rename — no surface behaves differently, no address moves except the one renamed route, and every snapshot is unchanged.

## What Changes

- Rename the whole-collection reading surface **placard → primer** throughout Display Case: the `/placard` route becomes `/primer`, the isolated `/render/placard` becomes `/render/primer`, the `placard` config key becomes `primer`, the `landing: 'placard'` option becomes `landing: 'primer'`, the `Placard ↔ Cases` mode switch becomes `Primer ↔ Cases`, and all components, types, CSS classes (`.dc-placard*`), the `dc-placard-*` postMessage protocol, the structure-check rule (`placard-present-and-used` → `primer-present-and-used`), and authored specimen directories rename accordingly.
- Rename the per-component documentation sibling convention **`<component>.prompt.md` → `<component>.placard.md`**: the 68 authored sibling docs, the discovery/manifest path resolution, the manifest's `promptDoc` field (→ `placardDoc`), the watch pattern, the two structure-check rules (`case-prompt-coverage` → `case-placard-coverage`, `no-orphaned-prompt-doc` → `no-orphaned-placard-doc`), their markers (`no-prompt` → `no-placard`, and the `allow-*` waivers), the authoring guide (`writing-prompt-docs.md` → `writing-placard-docs.md`), and the authoring skill (`display-case-author-prompt-doc` → `display-case-author-placard-doc`).
- **Leave genuinely-different `.prompt.md` files untouched:** `.github/prompts/*.prompt.md` are real Copilot prompt files, and `packages/display-case/display-case.prompt.md` is the package's AI-agent integration prompt — neither is a component placard.
- Fix a latent defect found during the rename: `src/ui/shell-core.ts` embedded raw NUL bytes as a composite-key delimiter, which made git classify the source as binary (and silently excluded it from text tooling). The delimiter is now the `\0` escape — identical runtime value, plain-text source.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `display-case`: the optional whole-collection reading surface, formerly the "placard", is renamed throughout to the **primer**, including its switch with the component catalog and its structure check. Behavior, addressing (beyond the one renamed route), themes, snapshots, and the specimen contract are unchanged.

## Impact

- **Spec**: `openspec/specs/display-case/spec.md` — renames the "Authored placard" and "Placard presence and use" requirements to "Authored primer" and "Primer presence and use", and updates the placard wording in "Pre-scripting rendered content" and "Live authoring updates". The per-component doc convention is an implementation detail (the spec names "authored usage documentation", never the file extension), so the `.prompt.md → .placard.md` rename carries no spec change.
- **Package** `packages/display-case`: route/handler/SSR renames (`/primer`, `/render/primer`, `ssr-primer.tsx`, `primer-mount.tsx`, `primer.tsx`), `primer-specimen(s)` directories, the `primer-present-and-used` rule, the `placardDoc` manifest field and `case-placard-coverage` / `no-orphaned-placard-doc` rules, the watch pattern, docs (`writing-placard-docs.md`), and the `display-case-author-placard-doc` skill.
- **Consumers** (`apps/web`, `apps/admin`, `packages/ui`): their `display-case.config.ts` `placard` key becomes `primer`; their `*.prompt.md` siblings become `*.placard.md`. No component code changes.
- **Snapshots & checks**: visual-regression baselines are unaffected (rendered content is identical); a11y, token, ssr, and structure checks pass; the renamed structure rules enforce the same conditions under their new ids.
- **History**: existing archived changes that reference "placard" are left frozen as the record of what was built at the time; this change documents the rename that supersedes those names.
