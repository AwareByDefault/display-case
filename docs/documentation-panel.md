# Documentation panel

> Nav: [Quick start](quick-start.md) · [Writing cases](writing-cases.md) · [Hierarchy](hierarchy.md) · [Tweaks](tweaks.md) · [Theming](theming.md) · **Documentation panel** · [Writing placard docs](writing-placard-docs.md) · [Testing](testing.md) · [CLI](cli.md) · [AI agents](ai-agents.md) · [Configuration](configuration.md)

Each component can carry prose documentation alongside its cases. Drop a `<component>.placard.md` file next to the component and Display Case renders it in a panel beside the showcase.

```
src/components/
  tweak-control.tsx
  tweak-control.case.tsx
  tweak-control.placard.md   ← rendered as the doc panel for "TweakControl"
```

There is nothing to wire up: the doc file is discovered automatically as the case file's sibling (same basename, `.placard.md` instead of `.case.tsx`). If the file is absent, the component simply has no doc panel — the manifest reports `placardDoc: null` for it.

## What renders

The Markdown is rendered as **full CommonMark + GFM** (GitHub Flavored Markdown via `remark-gfm`), so you get tables, task lists, strikethrough, and autolinks in addition to the core syntax:

```md
# TweakControl

A single typed tweak input.

## Kinds

| Kind      | Use for                          |
| --------- | -------------------------------- |
| `text`    | free-form string values          |
| `boolean` | on/off toggles                   |
| `choice`  | selecting from fixed options     |

## Guidance

- Label every control from the tweak key.
- ~~Never~~ avoid free text where a `choice` would do.
```

The raw file is also served verbatim at `/doc/<component>` with a `text/markdown` content type, which is useful for machine readers.

## Two intentional limits

- **Raw HTML is disabled.** Embedded `<div>`, `<script>`, `<style>`, etc. in a doc file are not rendered as markup — this prevents a doc from injecting into the showcase chrome. Stick to Markdown syntax.
- **No syntax highlighting.** Fenced code blocks render as plain styled `<pre><code>`. This is a deliberate non-goal for now; code is readable but not colorized.

## Why `.placard.md`

The doc lives in prompt-friendly Markdown, next to the component. Authoring usage guidance once, beside the code, means it surfaces both in the showcase and to any tool that reads the file directly — see [AI agents](ai-agents.md).

This page covers *how the panel renders*. For *what to put in the file* — the content that earns its place beside the types — see [Writing placard docs](writing-placard-docs.md).
