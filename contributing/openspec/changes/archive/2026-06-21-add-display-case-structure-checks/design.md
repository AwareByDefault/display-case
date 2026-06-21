## Context

Display Case ships a check command with three phases: a static design-token conformance check (`--tokens`, no browser) and two render-based checks (`--a11y`, `--visual`) driven through a headless browser. `runChecks` (`packages/display-case/src/check.ts`) runs the token phase first with no server, then — only if a render phase was requested — starts the dev server and drives each case in light + dark. Discovery (`src/discovery.ts`), config resolution (`resolveConfig`), the catalog/level model (`src/catalog.ts`, `HIERARCHY_LEVELS` in `src/index.ts`), and the manifest are all reusable, browser-free building blocks.

Best-practice conformance is currently enforced only by a repo-local lint, `tools/lint/src/checks/display-case-coverage.ts`, which checks one rule (a component `*.tsx` derived from `roots` has a sibling `*.case.tsx`) for this repository alone, with a `// display-case: no-case` per-file escape hatch. It does not ship with the package, so no other consumer benefits, and it does not cover prompt docs, levels, placard, or toolchain setup.

This change adds those checks to the package itself as a fourth, static **structure** phase.

## Goals / Non-Goals

**Goals:**
- A static, browser-free structure phase in the check command, runnable alone (`check --structure`) or as part of the default run.
- A set of independently disablable rules in three groups: file/config rules (case+prompt coverage, orphaned prompt docs, placard presence/use, snapshot-toolchain setup, config-path existence), catalog-integrity rules (level classification, case loadability, flow transition/step integrity, slug-collision, tweak-default validity), and opt-in composition rules (atom purity, no-downward-dependency, composes-lower-level) with cross-package level resolution.
- Per-phase control over what runs in the default (no-phase-flag) check run, including the existing token/a11y/visual phases.
- A per-target ignore escape hatch consistent with the existing `// display-case:` comment convention, plus a config-level ignore.

**Non-Goals:**
- No new runtime dependency; the structure phase is pure file/AST-free static analysis over already-discovered inputs.
- Not a linter for component *code* quality (that is the consumer's own ESLint/Biome); structure rules are about Display Case authoring conventions only.
- No judgement of whether placard prose is *meaningful*; the "used / not empty" rule parses the MDX structure (a `Display` specimen exists, the document has content) but does not evaluate content quality.
- Auto-fix is out of scope (the existing check command does not auto-fix either, aside from `--update` baselines).

## Decisions

### CLI surface: a `--structure` phase, not a separate command
`check` gains `--structure`, mirroring `--tokens`. With no phase flag, all phases run (subject to config below); naming any phase flag runs only the named phase(s) — unchanged semantics. Rationale: structure findings are conceptually the same artifact as token/a11y/visual findings (a per-showcase conformance report with a non-zero exit to gate CI), so one command with selectable phases keeps the mental model and the CI wiring single. A separate `lint` command was considered and rejected as a second surface to learn and document for no behavioral gain.

`--structure` is static like `--tokens`: it needs neither a browser nor the dev server. The existing early-return in `runChecks` (which skips starting the server when no render phase is requested) extends to cover `structure` + `tokens` together — `check --structure` and `check --tokens --structure` start nothing.

### Configuration shape
Extend `DisplayCaseConfig` with one `check` block:

```ts
check?: {
  /**
   * Whether each phase participates in the default (no-phase-flag) run.
   * Unset ⇒ included. Set false to opt a phase out of the default run; it can
   * still be invoked explicitly by naming its flag.
   */
  defaultPhases?: Partial<Record<'tokens' | 'a11y' | 'visual' | 'structure', boolean>>
  /** Structure-phase rule configuration; each rule is on (at its default severity) unless overridden here. */
  structure?: {
    rules?: Partial<Record<StructureRuleId, StructureRuleSetting>>
  }
}

type StructureSeverity = 'warn' | 'error'
// false ⇒ disabled; a bare severity ⇒ enabled, overriding the rule's default severity;
// an options object ⇒ enabled with per-rule overrides.
type StructureRuleSetting = false | StructureSeverity | StructureRuleOptions
interface StructureRuleOptions {
  severity?: StructureSeverity
  ignore?: string[]
  // plus rule-specific options (e.g. level-fit thresholds)
}
```

- `defaultPhases` answers the clarified requirement: a showcase can drop, say, `visual` from the default run (e.g. no baselines committed) while still running `check --visual` on demand. The CLI computes the default phase set as "all phases where `defaultPhases[phase] !== false`"; an explicit phase flag always overrides config (you can always run a phase you opted out of).
- `structure.rules[id]`: `false` disables the rule; `'warn'`/`'error'` enables it at that severity; an options object enables it with overrides (severity, `ignore` globs, rule-specific options). Unset ⇒ enabled at the rule's default severity. This keeps "each rule independently disablable" declarative and adds severity tuning without a second config axis.

The token phase's existing `tokens.allow` config is unchanged and independent.

### The rules
A new `src/structure-check.ts` exports `checkStructure(pkgDir, config): Promise<{ findings: StructureFinding[] }>`, mirroring `tokens-check.ts`. Each finding carries `{ rule, severity, file, message }`. The rules fall into three groups by what they read. "Default" = whether the rule runs out of the box; "Severity" = its default severity (see the severity decision below).

**File / config rules** (filesystem + config only):

| Rule id | What it checks | How | Default | Severity |
| --- | --- | --- | --- | --- |
| `case-prompt-coverage` | Each showcasable component has a sibling `*.case.tsx` **and** `*.prompt.md`. | Derive component modules from `roots` exactly as the repo lint does (`*.case.tsx` root → `*.tsx` siblings; skip `*.case.tsx`, `*.d.ts`, `*.test.*`). Report each missing sibling. | on | error |
| `no-orphaned-prompt-doc` | Each `*.prompt.md` under the roots' directories has a sibling `*.case.tsx`. | Glob `*.prompt.md` in the same directories the roots cover; report any with no `<name>.case.tsx`. A component `*.tsx` is **not** required. | on | error |
| `placard-present-and-used` | A placard is configured, exists, embeds `<Display>` specimens, and is not effectively empty. | `config.placard` set → file exists → parse the MDX to an mdast tree and require ≥1 JSX element named `Display` plus non-whitespace content. See the placard-parse decision below. | on | error |
| `setup-present` | Render checks can actually run. | `config.providers.driver`/`diff` set ⇒ pass; else probe that the default toolchain (`playwright`, `@axe-core/playwright`, `pixelmatch`, `pngjs`) resolves from **either** the consumer package **or** the display-case package (`Bun.resolveSync(pkg, dir)` for `dir ∈ [pkgDir, toolingDir]`). Two locations because the visual backend resolves the toolchain relative to display-case, not the consumer — so a transitively-provided toolchain is not a false miss. Resolve-only; never launches a browser. | on | error |
| `config-paths-exist` | Config file references resolve. | `globalStyles` and `baselineDir` (when set) point at existing paths. | on | error |

**Catalog-integrity rules** (read the loaded modules / built catalog — no import resolution):

| Rule id | What it checks | How | Default | Severity |
| --- | --- | --- | --- | --- |
| `levels-classified` | Every discovered case module declares a level in `HIERARCHY_LEVELS`. | Reuse `loadModules`; report any module whose `level` is null/undefined (the unclassified bucket). Flows are always `flow`, so inherently pass. | on | error |
| `cases-load` | Every discovered case file loads. | Surface `loadModules` errors (malformed/throwing case files) as gated findings rather than only at manifest build. | on | error |
| `flow-transitions-resolve` | Each flow step `transitions` target names an existing step. | Compare each step's slugified `transitions` against the flow's own step ids; report dangling targets. | on | error |
| `flow-multi-step` | A flow has more than one step. | Report any `isFlow` module with ≤1 case (a single state should be a regular case, not a flow). | on | error |
| `unique-slugs` | No two components — or two cases within a component — collide on their address slug. | Detect duplicate `slugify(name)` among components and within each component's cases. | on | error |
| `tweak-defaults-valid` | A `choice` tweak's `default` is one of its `options`. | Walk each case's tweak schema; report a `choice` whose `default ∉ options`. | on | error |

**Composition (import-graph) rules** — opt-in, default **off**; see the composition decision below:

| Rule id | What it checks | Default | Severity |
| --- | --- | --- | --- |
| `atom-purity` | An `atom` imports no other showcased component. | off | error |
| `no-downward-dependency` | No component imports a component of a **strictly higher** level (atom→organism, molecule→organism, …). | off | error |
| `composes-lower-level` | A component above `atom` imports at least one showcased component of a lower level. An organism composed only of atoms passes (Frost: "molecules **and/or atoms** and/or other organisms"). | off | warn |
| `level-fit` | A component composes more lower-level components than recommended for its level — a hint to promote it (e.g. a molecule wiring many atoms may be an organism). | off | warn |

`level-fit` is purely advisory: it never fails a run at its default severity. Its threshold is configurable per level via options, e.g. `{ thresholds: { molecule: 8 } }` (suggest promoting a molecule that composes more than 8 lower-level components); unset levels use built-in defaults. Like the other composition rules it relies on the import graph and is off by default.

### Severity: warn vs error
Every finding carries a severity. **`error`** findings fail the run (contribute to the non-zero exit); **`warn`** findings are reported but do **not** fail it. The run's exit code is non-zero iff at least one `error`-severity finding exists across all phases — so warnings are visible without breaking a build that has only advisory issues.

- **Defaults** follow confidence: the high-confidence structural rules default to `error`; the heuristic / false-positive-prone ones default to `warn` (`composes-lower-level`, `level-fit`). A consumer retunes any rule via `structure.rules[id] = 'warn' | 'error'`.
- **Output** distinguishes them: `  structure ✗ <relpath>: <message>` for errors, `  structure ⚠ <relpath>: <message>` for warnings. The summary reports both counts (e.g. `✗ 2 error(s), 3 warning(s)`), and the existing token/a11y/visual violations remain errors.
- **Strict mode** for CI that wants zero warnings: `check --structure --strict` (and a `check.structure.strict` config equivalent) escalates all structure warnings to errors for that run, so a team can ratchet up enforcement without rewriting every rule's severity.
- **Unresolved composition imports surface as warnings, scoped.** An import the resolver cannot map to a showcased component is still never an `error` (it cannot trip `no-downward-dependency`), but when it *looks like* it should be resolvable — a bare specifier into another workspace package that has a showcase, where re-export following failed — the composition rules emit a `warn` ("could not resolve `X` from `@scope/pkg` to a level; skipped"). Arbitrary third-party/util imports stay silent. This makes the resolver's blind spots visible without crying wolf on every `import { useState } from 'react'`.

### Execution model: one phase, rules concurrent, shared inputs computed once
- **One phase, many rules.** `structure` is a single check phase; the rules are sub-units configured under `structure.rules`, *not* phases. Phases are the user-facing run unit (a flag, a `defaultPhases` toggle, an exit-grouped report); one-phase-per-rule would multiply the CLI surface and conflate "phase" with "rule." So there is exactly one `--structure` flag, not one per rule.
- **Shared inputs once.** `checkStructure` computes the expensive shared inputs a single time — config resolution, `discoverCaseFiles`, `loadModules`/`buildCatalog`, and (for composition rules) any imported workspace showcase's catalog — and passes them to every rule. No rule re-runs discovery. This sharing, not rule fan-out, is what governs the phase's runtime.
- **Rules run concurrently, not in parallel.** The rules are independent and mostly I/O (filesystem stat/read) with light CPU (one MDX `parse`, the transpiler import-scans), so they run via `Promise.all` over the rule set. This is event-loop concurrency — overlapping async I/O on a single thread — *not* parallelism: no worker threads or processes. The total workload is low-hundreds-of-ms even on a large showcase, so worker-based parallelism would cost more in setup and serialization than it saves.
- **Phases stay sequential.** `runChecks` runs phases in order (tokens → structure → render) so output stays grouped and deterministic and the static phases complete before any server starts.

### No concurrency/parallelism knob
The phase deliberately exposes no concurrency setting. Its runtime is dominated by the shared discovery (done once), not by how many rules run at once, so a knob would tune the cheap part. If a future rule becomes genuinely heavy (e.g. the composition import-graph over a very large tree), the remedy is internal batching within that rule — still automatic via `Promise.all` — rather than a user-facing dial. Revisit only if profiling shows a real ceiling.

### Placard rule parses the MDX rather than scanning text
`placard-present-and-used` parses the placard to an mdast tree and inspects it, instead of regex-scanning the source. This is effectively free: `@mdx-js/mdx` is already a normal (non-optional) dependency — the placard bundler plugin uses it — so there is no new package. The check calls `createProcessor()` (which registers `remark-mdx`, so JSX is represented as `mdxJsxFlowElement` / `mdxJsxTextElement` nodes carrying a `.name`) and runs `processor.parse(text)` — parse only, no compile-to-JS — then walks the tree for ≥1 element named `Display` and any non-whitespace content node ("effectively empty" signal). The walk is a ~10-line recursion over `node.children`, hand-rolled to avoid adding `unist-util-visit` (not currently a resolvable dependency). Parse is wrapped in try/catch so a malformed placard yields a clean "could not parse placard" finding rather than a stack trace.

Cost: a single-file `parse` is single-digit milliseconds — smaller than the token regex sweep over every source file, far below the render-based phases, and cheaper than the full `compile` the bundler already runs on the same file. A text scan was rejected: it mispredicts on multiline/attributed/self-closing `<Display>`, nesting, and `{/* … */}` comments, and a parse is both more accurate and, given the existing dependency, no costlier. Parsing does not *execute* the document — it only reads it — so this remains a static, browser-free check.

### Composition (import-graph) rules
The three composition rules enforce that composition flows *up* the hierarchy. They share one mechanism: scan a component's source imports with `Bun.Transpiler.scanImports` (no AST dependency, ignores `import type`), resolve each specifier to a file, and look that file up in a **level resolver** that maps a component-source path to its declared hierarchy level (built from the catalog; see cross-package resolution below). With levels in hand:

- **`atom-purity`** — a component at `atom` level must import *no other* showcased component (atoms are leaves: "can't be broken down further"). Strictest, atom-specific (forbids importing even other atoms).
- **`no-downward-dependency`** — no component imports a *strictly higher*-level component. Same-level imports are allowed on purpose: an organism composed of other organisms is canonical. This is the defensible generalization of "composition flows upward" and catches genuine inversions (an atom depending on an organism).
- **`composes-lower-level`** — a non-atom component must import ≥1 showcased component of *some* lower level. This is the positive form of the original ask (molecule⇒atom, organism⇒molecule); we relax "immediately lower" to "any lower" because Brad Frost's own definition allows an organism to be *"composed of groups of molecules **and/or atoms** and/or other organisms"* — an organism built from atoms only is valid, so requiring a molecule specifically would flag correct organisms.

**Why default-off.** Two false-positive sources survive even a good resolver: (1) **children/props composition** — `<Card><Button/></Card>` often wires the atom in the *case* file, not via an import in the component source, so `composes-lower-level` can't see it; (2) **barrel/re-export and exotic import forms** the resolver can't follow (below). `no-downward-dependency` and `atom-purity` are negative checks and far safer, but the trio ships opt-in so a consumer turns them on once their library matches the import-composed assumption. `composes-lower-level` is the most FP-prone and should be enabled last.

### Cross-package level resolution
The level resolver must handle imports from *another* showcase in the same workspace — the common "a molecule imports its atoms from the shared UI library (`@acme/ui`)" case — or `composes-lower-level` would false-positive on every such molecule. Assessment of feasibility (validated against this repo):

- **Workspace resolution works.** A bare specifier like `@acme/ui` resolves to a workspace package dir. If that dir has its own `display-case.config.ts`, it is a showcase; load and cache *its* catalog once, giving a path→level map for that package's components.
- **Named import → file needs re-export following.** `import { Button } from '@acme/ui'` lands on the package entry (`src/index.ts`), a barrel of `export { Button } from './components/button'`. `Bun.Transpiler.scanImports`/`.scan` give export *names* and re-export *paths* but **do not bind name→source**, so the resolver parses the barrel's `export { … } from '…'` statements itself to map `Button` → `./components/button` → `button.tsx`, then to its sibling case's level. The common `export { A, B } from '…'` form (what ui uses) is straightforward; `export *`, renamed re-exports, default re-exports, and multi-hop barrels degrade gracefully to **unresolved**.
- **Published (non-workspace) packages are out of scope.** Display Case is dev-only and `*.case.tsx` files are not in a published artifact, so a third-party dependency exposes no levels. Such imports resolve to **unresolved**.
- **Unresolved is never an error by itself.** An import the resolver can't map to a showcased component is treated as "not a showcased component" — it cannot trip `no-downward-dependency` and doesn't count toward `composes-lower-level`. When the import *looks* resolvable (a workspace package with a showcase, re-export following failed) the rules emit a scoped `warn` so the blind spot is visible; arbitrary imports stay silent (see the severity decision).

Net: cross-package resolution covers the realistic monorepo scenario (shared workspace UI lib), which removes the biggest `composes-lower-level` false positive; the residual blind spots (children-composition, exotic barrels) are why the composition rules stay opt-in. The resolver caches each foreign catalog per run, so the extra cost is one catalog build per imported showcase package, amortized across all components.

### Escape hatches
Two layers, both consistent with the existing convention:
- **In-file marker** — a `display-case: <token> <reason>` comment exempts that file. Tokens are rule-scoped so an exemption is narrow: `no-case` / `no-prompt` (in a component `*.tsx`, reusing the existing `no-case` token), `allow-orphan` (in a `*.prompt.md`, as an MDX/HTML comment), `unclassified` (in a `*.case.tsx`). All other rules accept a generic `display-case: allow-<rule-id> <reason>` marker in the relevant source file (e.g. `allow-no-downward-dependency` in a component `*.tsx`). A reason is expected after the token, matching the repo lint's documented style.
- **Config ignore** — `structure.rules[id] = { ignore: [glob, …] }` exempts matching paths from that rule, for cases where a marker comment is impractical. This is the only escape hatch for rules whose finding is not attributable to a single editable source file (e.g. `unique-slugs`).

### Output and exit code
Structure findings print in the established format — `  structure ✗ …` for `error`, `  structure ⚠ …` for `warn` (see the severity decision) — and are counted alongside token/a11y/visual violations. Only `error`-severity findings contribute to the non-zero exit; warnings print but do not fail the run (unless `--strict`/`check.structure.strict` escalates them). The summary line gains structure error and warning counts. `runChecks`'s return stays `boolean` (true ⇒ no error-severity findings in any phase).

### Reuse over reimplementation
The structure check imports `discoverCaseFiles`, `resolveConfig`, `loadModules`, `buildCatalog`, and `HIERARCHY_LEVELS` rather than re-globbing or re-parsing. The repo-local `display-case-coverage` lint becomes a strict subset of `case-prompt-coverage`; this change does not delete it but notes it as supersedable (the repo can later run `display-case check --structure` in its lint pipeline instead).

## Risks / Trade-offs

- **Placard "used / not empty" is a structural, not semantic, judgement** → Parsing the MDX proves a `Display` element exists and the document has content, but cannot prove the prose is *meaningful* or that every specimen is the right one. Mitigation: the rule asserts the structural facts it can (configured + exists + parses + ≥1 `Display` element + non-whitespace content), which the parse establishes precisely; consumers whose placard authoring differs can disable the rule.
- **Placard parse can throw on malformed MDX** → `parse` rejects invalid MDX. Mitigation: try/catch turns a parse failure into a "could not parse placard" finding (the bundler would fail on the same file anyway), so the phase never crashes on it.
- **`setup-present` probing imports optional packages** → Probing importability could be slow or have side effects. Mitigation: resolve module specifiers without executing browser code (a dynamic `import` of the package entry, caught), exactly the lazy-load path `check.ts` already uses; no `playwright install` or browser launch.
- **Composition rules misjudge children/props composition** → `<Card><Button/></Card>` wires the atom in the case file, so `composes-lower-level` sees no import and false-positives. Mitigation: composition rules are opt-in (default off); the per-file `allow-<rule>` marker and config `ignore` cover the legitimate exceptions.
- **Cross-package resolution can't follow exotic barrels** → `export *`, renamed/default re-exports, and multi-hop barrels resolve to "unresolved." Mitigation: unresolved imports are never a violation by themselves, so the failure mode is a missed detection (under-report), not a false alarm — the safe direction for an opt-in rule.
- **Import scanning assumes import-based composition** → A library that composes via a registry, slots, or runtime wiring won't be understood. Mitigation: opt-in default; documented as suited to import-composed libraries.
- **Deriving components from `roots` mirrors the repo lint's assumption** that component modules are `*.tsx` siblings of `*.case.tsx`. → A showcase organized differently could get false positives. Mitigation: the per-file marker and config `ignore` provide an exit; the assumption is already the documented Display Case convention.
- **New config surface** (`check.defaultPhases`, `check.structure`) widens `DisplayCaseConfig`. → Kept additive and optional; absent config preserves today's behavior exactly (all phases run, all rules on).

## Migration Plan

- Purely additive: no config change is required of existing consumers; defaults reproduce current behavior plus the new structure phase running in the default check.
- This repository's own `display-case.config.ts` may add `check.structure` overrides if its current showcase has known, accepted gaps (e.g. components intentionally without prompt docs), surfaced when the phase first runs.
- Follow-up (not in this change): retire `tools/lint/src/checks/display-case-coverage.ts` in favor of the package check.

## Open Questions

- Should `setup-present` distinguish "visual configured but a11y not" given both share the default toolchain today? Current decision: one rule, since the default backend is a single toolchain; revisit if the backends split.
