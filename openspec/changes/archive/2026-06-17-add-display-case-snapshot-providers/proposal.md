## Why

Display Case's `check` runner hard-wires its visual pipeline to Playwright (capture + accessibility audit) and pixelmatch/pngjs (image diff). That forces every consumer who runs checks to take those heavy dependencies and a browser download, even if they already have a browser-automation setup or prefer a different capture/diff backend. It also leaves the dependencies as ambiguous `devDependencies` (fine in this workspace, broken for a standalone install — see the `add-display-case-agent-init` discussion). Making the capture/audit and image-comparison steps **pluggable**, with the current behavior as a lazily-loaded default, decouples the tool from any specific backend and makes those dependencies genuinely optional.

## What Changes

- Allow the **snapshot pipeline to be overridden in `display-case.config.ts`**: a consumer may supply a custom **render driver** (opens a case URL and provides a screenshot + an accessibility audit) and/or a custom **image-diff** function. When unset, Display Case falls back to its **built-in default** (Playwright + axe driver, pixelmatch/pngjs diff), which is **imported lazily** — only when the default is actually used.
- Treat the default backend's packages (`playwright`, `@axe-core/playwright`, `pixelmatch`, `pngjs`) as **optional**: present them as `optionalDependencies`, lazy-load them in the default providers, and fail with a clear, actionable message (how to install them, or to inject custom providers) only when a check needs a missing default.
- Add an **optional visual-regression setup step to `display-case init`**: offer to install the default snapshot toolchain (the packages above) and the browser it needs. Opt-in via a flag for non-interactive/agent use, and offered as a prompt when run interactively; declining leaves the repo untouched.

## Capabilities

### New Capabilities
<!-- None — extends the existing display-case tool. -->

### Modified Capabilities
- `display-case`: the visual-regression capture/audit mechanism and the image-comparison mechanism become configurable, with a built-in default used when unconfigured; and the agent-integration install command gains an optional step to set up the default visual-regression toolchain.

## Impact

- **`packages/display-case/`**: `DisplayCaseConfig` gains optional provider hooks; `check.ts` resolves provider-or-default and lazy-loads the default; `package.json` moves the four backend packages to `optionalDependencies`; `init` gains the optional setup step.
- **Docs**: `docs/testing.md` and `docs/configuration.md` document the provider interface, the default, and the lazy/optional behavior; `docs/ai-agents.md`/README note the `init` setup step.
- **No behavior change by default**: with no config and the default deps installed, checks behave exactly as today.
