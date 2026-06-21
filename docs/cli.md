# CLI

> Nav: [Quick start](quick-start.md) · [Writing cases](writing-cases.md) · [Hierarchy](hierarchy.md) · [Tweaks](tweaks.md) · [Theming](theming.md) · [Documentation panel](documentation-panel.md) · [Writing placard docs](writing-placard-docs.md) · [Testing](testing.md) · **CLI** · [AI agents](ai-agents.md) · [Configuration](configuration.md)

The CLI takes a package directory (`<pkgDir>`) — the directory containing the `display-case.config.ts`. It defaults to the current directory when omitted.

```bash
display-case <pkgDir> [--port=N]
display-case <pkgDir> --print-manifest
display-case check <pkgDir> [--tokens] [--a11y] [--visual] [--update] [--port=N]
display-case init <pkgDir> [--agent=claude] [--with-visual] [--dry-run] [--json]
display-case uninstall <pkgDir> [--agent=claude] [--dry-run] [--json]
```

`init` / `uninstall` scaffold (or remove) Display Case's AI-agent integration — a launch entry, the bundled skills, and an agent-guide pointer. See [AI agents → Scaffolding integration](ai-agents.md#scaffolding-integration-init--uninstall).

Display Case requires Bun. Invoke it with `bunx`:

```bash
bunx display-case <pkgDir>          # dev server
bunx display-case check <pkgDir>    # checks
```

For day-to-day use, add npm scripts and run them via `bun run`:

```jsonc
// package.json
{
  "scripts": {
    "display-case": "display-case .",
    "display-case:check": "display-case check ."
  }
}
```

```bash
bun run display-case          # dev server
bun run display-case:check    # checks
```

## `display-case <pkgDir>` — dev server

Discovers cases, bundles them with Bun, and serves the browsing UI. The server URL is printed on start, and it rebuilds automatically when a `*.case.tsx` or `*.placard.md` file under `src/` changes (refresh to pick up — there is no in-page HMR).

| Flag | Default | Description |
| --- | --- | --- |
| `--port=N` | `3100` | Port to serve on. |

```bash
display-case .
display-case . --port=4000
```

The served endpoints are documented in [AI agents](ai-agents.md#endpoints).

## `display-case <pkgDir> --print-manifest`

Builds the manifest once, prints it to stdout as formatted JSON, and exits `0`. No server is started. This is the recommended way for a machine reader to enumerate everything available.

```bash
display-case . --print-manifest
```

See [AI agents](ai-agents.md) for the manifest shape and how to use it.

## `display-case check <pkgDir>` — structure + token + a11y + visual checks

Runs four phases: **structure** best-practice rules (static; no browser), design-token conformance (a static `var()` parse, no browser), headless accessibility (axe-core), and visual-regression (pixel diff). The a11y and visual phases run over every case in both light and dark themes; structure and tokens need neither a browser nor the server. Exits `0` when everything passes, `1` when any **error**-severity finding is produced.

The a11y phase prints each violation's affected nodes (for colour-contrast, the failing element and the measured-vs-required pair) and writes the full run to `.display-case/a11y/last-check.json` for reading without re-running — see [Testing → Accessibility](testing.md#accessibility).

| Flag | Default | Description |
| --- | --- | --- |
| `--structure` | — | Run the static best-practice rules (coverage, levels, primer, setup, composition…). See [Testing](testing.md#structure-checks). |
| `--tokens` | — | Run design-token conformance (static; no browser). See [Testing](testing.md#token-conformance). |
| `--a11y` | — | Run accessibility checks. |
| `--visual` | — | Run visual-regression checks. |
| `--update` | off | (Re)record visual baselines from the current renders. |
| `--strict` | off | Treat structure warnings as errors for this run. |
| `--only=ids` | — | Scope the render phases (a11y/visual) to these component ids or globs (comma-separated). |
| `--changed[=ref]` | — | Scope the render phases to components a change touched since `ref` (default the base branch, or `DISPLAY_CASE_BASE_REF`). |
| `--port=N` | ephemeral | Port for the internal server the checks drive. |

**Default behavior:** if no phase flag is given, **all** phases run — except any a config opts out via [`check.defaultPhases`](configuration.md). Pass one or more phase flags to narrow to just those phases; an explicit flag always runs that phase regardless of config.

**Change-scoping the render checks.** `--only` / `--changed` restrict the (slow, browser-backed) a11y and visual phases to a subset of components — the static phases are unaffected. With `--changed`, a component is in scope when a changed file is in its import closure; a change to a globally-applied stylesheet or the shared render path scopes to **all** components, and a change with no render inputs (docs, tests) scopes to **none** (the render phases pass without launching a browser). This is what the CI a11y/visual jobs use. See [Testing → Change-scoped checks](testing.md#change-scoped-checks).

```bash
display-case check .                       # all phases (minus config opt-outs)
display-case check . --structure           # best-practice rules only (fast, no browser)
display-case check . --tokens              # token conformance only (fast, no browser)
display-case check . --a11y                # a11y only
display-case check . --structure --strict  # structure rules, warnings fail the run
display-case check . --visual --update     # record/refresh visual baselines
display-case check . --a11y --only=button  # a11y for one component
display-case check . --a11y --visual --changed=origin/main  # only what this branch touched
```

Full details — the structure rules and their escape hatches, baselines, diff outputs, exit codes — are in [Testing](testing.md). Per-rule severity and enable/disable live in [Configuration](configuration.md).
