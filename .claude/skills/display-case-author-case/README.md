# display-case-author-case

Scaffold a `*.case.tsx` for a component that doesn't have one yet.

## What it does

Reads a component's source for its real props, then writes a colocated case file that default-exports `defineCases(...)` — a `Default`, the meaningful variants, and a `Playground` with typed tweaks — tagged with the right Atomic Design `level`. The result shows up in the showcase and satisfies the `display-case-coverage` lint.

## When it triggers

The coverage check fails for a component, a new shared component is added, or someone asks to "add a case" / "showcase this component".

## How it works

1. Read `<name>.tsx` (and `<name>.placard.md`) for exports and prop types.
2. Write `<name>.case.tsx` with variants + a tweaks playground, choosing the hierarchy `level` by composition.
3. Keep cases side-effect-free (lazy thunks; stateful demos as inner components).
4. Verify with `bun run display-case`; the `display-case-coverage` lint passes.

Authoring spec: [`../../display-case.prompt.md`](../../display-case.prompt.md).
