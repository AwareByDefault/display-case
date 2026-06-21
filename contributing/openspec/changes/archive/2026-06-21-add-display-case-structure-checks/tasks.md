## 1. Configuration surface

- [x] 1.1 Add the `check` block to `DisplayCaseConfig` in `packages/display-case/src/index.ts`: `defaultPhases?: Partial<Record<'tokens'|'a11y'|'visual'|'structure', boolean>>` and `structure?: { rules?: Partial<Record<StructureRuleId, false | StructureRuleOptions>> }`, with doc comments.
- [x] 1.2 Define and export `StructureRuleId` (all rule ids across the file/config, catalog-integrity, and composition groups), `StructureSeverity = 'warn' | 'error'`, `StructureRuleSetting = false | StructureSeverity | StructureRuleOptions`, and `StructureRuleOptions` (`{ severity?, ignore?, plus rule-specific options }`). Encode per-rule default enabled-state (composition + `level-fit` off, others on) and default severity (`composes-lower-level`/`level-fit` warn, others error). Add `check.structure.strict?: boolean`.

## 2. Structure-check module

- [x] 2.1 Create `packages/display-case/src/structure-check.ts` exporting `checkStructure(pkgDir, config): Promise<{ findings: StructureFinding[] }>`, with a `StructureFinding { rule, severity, file, message }` type, mirroring `tokens-check.ts`. Compute shared inputs (config, `discoverCaseFiles`, `loadModules`/`buildCatalog`) once and pass them to each enabled rule; resolve each rule's effective severity from its default + `structure.rules[id]` override; run the rules concurrently via `Promise.all` (no worker threads); no concurrency config knob.
- [x] 2.2 Add a rule registry that reads `config.check?.structure?.rules`, treats unset as enabled, `false` as disabled, and an options object as enabled-with-options; apply per-rule `ignore` globs.
- [x] 2.3 Implement `case-prompt-coverage`: derive component modules from `roots` (`*.case.tsx` → `*.tsx` siblings; skip `*.case.tsx`/`*.d.ts`/`*.test.*`), require sibling `*.case.tsx` and `*.prompt.md`; honor `// display-case: no-case` / `no-prompt` markers.
- [x] 2.4 Implement `no-orphaned-prompt-doc`: glob `*.prompt.md` in the roots' directories, flag any without a sibling `*.case.tsx`; honor an `<!-- display-case: allow-orphan -->` marker.
- [x] 2.5 Implement `levels-classified`: reuse `discoverCaseFiles` + `loadModules`, flag modules with null/undefined `level`; honor a `// display-case: unclassified` marker.
- [x] 2.6 Implement `placard-present-and-used`: require `config.placard` set and the file to exist, then parse it via `@mdx-js/mdx`'s `createProcessor().parse(text)` and walk the mdast (hand-rolled recursion over `node.children`, no `unist-util-visit`) for ≥1 JSX element named `Display` plus any non-whitespace content; wrap the parse in try/catch so malformed MDX becomes a "could not parse placard" finding.
- [x] 2.7 Implement `setup-present`: pass when `config.providers.driver`/`diff` set, else probe that each default-toolchain package resolves from **either** the consumer package or the display-case package (`Bun.resolveSync(pkg, dir)` for `dir ∈ [pkgDir, toolingDir]`, `toolingDir` defaulting to the display-case package and overridable for tests) without launching a browser; report the install hint only when neither location resolves it. The two-location probe avoids false misses when the toolchain is provided transitively via display-case (the normal consumer shape).
- [x] 2.8 Implement `config-paths-exist`: verify `globalStyles` entries and `baselineDir` (when set) resolve to existing paths.

## 2b. Catalog-integrity rules (no import resolution)

- [x] 2b.1 Implement `cases-load`: surface `loadModules` errors as structure findings.
- [x] 2b.2 Implement `flow-transitions-resolve`: for each `isFlow` module, check every step's slugified `transitions` target exists among the flow's step ids.
- [x] 2b.3 Implement `flow-multi-step`: report any `isFlow` module with ≤1 case.
- [x] 2b.4 Implement `unique-slugs`: detect duplicate `slugify(name)` across components and within each component's cases.
- [x] 2b.5 Implement `tweak-defaults-valid`: walk each case's tweak schema, report a `choice` tweak whose `default ∉ options`.

## 2c. Composition (import-graph) rules — opt-in, default off

- [x] 2c.1 Build a level resolver: a path→`HierarchyLevel` map for the current package's component-source files (derived from the catalog), plus a `resolveImport(specifier, fromFile)` that resolves relative imports to files and returns the imported component's level (or "unresolved").
- [x] 2c.2 Extend the resolver for cross-package: resolve a bare specifier to a workspace package dir, detect a sibling `display-case.config.ts`, load+cache that package's catalog, and follow the package entry's `export { … } from '…'` re-exports to map a named import to a component file/level; degrade unknown forms (`export *`, renames, default, multi-hop) to "unresolved".
- [x] 2c.3 Implement `atom-purity`: scan an `atom` component's imports (`Bun.Transpiler.scanImports`, ignoring `import type`); report any import that resolves to another showcased component.
- [x] 2c.4 Implement `no-downward-dependency`: report any import that resolves to a strictly-higher-level showcased component; allow same/lower; never fire on unresolved imports.
- [x] 2c.5 Implement `composes-lower-level`: report a non-`atom` component whose imports resolve to no lower-level showcased component (counting cross-workspace showcases); an organism composed only of atoms passes. Default warn severity.
- [x] 2c.6 Implement `level-fit` (advisory): flag a component composing more lower-level showcased components than the configured per-level threshold (`{ thresholds: { molecule?, organism?, … } }`, built-in defaults otherwise). Default off, warn severity.
- [x] 2c.7 Emit a scoped `warn` from the composition rules when an import into a workspace package that has a showcase cannot be resolved (re-export following failed); stay silent for arbitrary/third-party imports.

## 3. CLI + runner integration

- [x] 3.1 Add `--structure` to the `check` flag parsing in `packages/display-case/src/cli.ts` and include it in the `anyPhase` calculation.
- [x] 3.2 Compute the default phase set from `config.check?.defaultPhases` (a phase runs in a no-flag run unless set to `false`); ensure an explicit phase flag always wins over the config opt-out.
- [x] 3.3 Wire `structure` into `runChecks` in `packages/display-case/src/check.ts`: run it in the static pre-server section alongside tokens; print findings as `  structure ✗ …` (error) / `  structure ⚠ …` (warn); extend the no-server early-return to cover structure-only / tokens+structure runs; fold error and warning counts into the summary; and make the exit non-zero only when an error-severity finding exists in any phase.
- [x] 3.4 Add `--strict` to `check` (and honor `check.structure.strict`): escalate all structure warnings to errors for the run.

## 4. Tests

- [x] 4.1 Add `packages/display-case/src/structure-check.test.ts` covering each rule: violation present, clean pass, exemption marker, config ignore, and rule-disabled — using fixture dirs as `tokens-check.test.ts` does. Include catalog-integrity rules (flow transition/step, slug collision, tweak default, cases-load) and composition rules (atom purity, no-downward, composes-lower) with both same-package and cross-package-workspace fixtures, plus an unresolved-import-is-not-a-violation case.
- [x] 4.2 Add CLI/runner coverage that `check --structure` runs no server and that `check.defaultPhases` opts a phase out of the no-flag run while explicit invocation still runs it.
- [x] 4.3 Cover severity behavior: a warn-only run exits zero, an error fails, a per-rule severity override flips the exit, and `--strict` escalates warnings to errors.
- [x] 4.4 Cover `setup-present`'s two-location probe: missing when neither the consumer nor the tooling dir resolves it, present when only the tooling dir does, and present with a custom provider. Also cover the remaining branches: `config-paths-exist` baselineDir-points-at-a-file (and absent-is-fine), and the generic `allow-<rule-id>` composition marker.

## 5. Documentation

- [x] 5.1 Update `packages/display-case/docs/cli.md` (new `--structure` flag + default-phase config) and `packages/display-case/docs/testing.md` (the structure rules and their escape hatches).
- [x] 5.2 Update the check table in `packages/display-case/README.md` and the agent guide (`docs/ai-agents.md`) to mention the structure phase.
- [x] 5.3 Add the `check.structure` / `check.defaultPhases` config keys to `packages/display-case/docs/configuration.md`.

## 6. Repo adoption

- [x] 6.1 Run `display-case check --structure` against this repo's showcases (display-case, ui, apps/web, apps/admin); record accepted gaps. After the `setup-present` two-location probe (2.7) the only remaining gap is the absent Placard, so each consumer showcase disables `placard-present-and-used` (with a reason) and needs no `setup-present` override.
- [x] 6.2 Note in `docs/NOTES.md` that the package's `case-prompt-coverage` rule supersedes the repo-local `tools/lint` `display-case-coverage` check (retirement tracked as follow-up).

## 7. Validation

- [x] 7.1 `openspec validate add-display-case-structure-checks --strict` passes.
- [x] 7.2 `bun test` in `packages/display-case` and the full `bun run lint` pass.
