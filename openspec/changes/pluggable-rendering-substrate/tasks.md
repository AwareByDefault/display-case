# Tasks — Pluggable Rendering Substrate

Ordered per the issue's suggested path: the neutral-core export first (independently
useful), then the no-op DOM extraction (where the design risk lives), then the
generalizations. The Carte substrate itself is out-of-tree and not in this list.

## 1. Substrate-neutral core export

- [x] 1.1 Add the `./core` subpath export exposing the authoring API plus `core/discovery`, `core/catalog`, `core/manifest`, `core/groups`, and `render/render-node` (`caseTree`, `resolveTweaks`, `encodeOverrides`), documented as experimental (design D11)
- [x] 1.2 Add the `Substrate` contract types (`Substrate`, `SubstrateVariantAxis`, render/document contexts) to the core export (design D1)
- [x] 1.3 Guard the import direction with a test: the core export's module graph pulls nothing from `server/`, `checks/`, `commands/`, or `ui/`
- [x] 1.4 Update `package.json` exports and the source-layout docs; `bun run lint && bun run typecheck && bun test` green

## 2. Substrate interface with the DOM path as its first implementation (behavior no-op)

- [x] 2.1 Add the `substrate` config key to `DisplayCaseConfig`, defaulting to `domSubstrate()`; substrate-specific options arrive via the factory, existing DOM-shaped top-level keys route into the DOM substrate (design D1)
- [x] 2.2 Extract the DOM renderer into `domSubstrate()`: `ssr-render` behind `render()`, `renderDoc` behind `document()` (design D2), style collection moved wholly inside the DOM frame type (design D10), mount/hydration as `stage.entry`
- [x] 2.3 Route the dev server, prod server, render endpoint, and publish pipeline through the substrate seam; promote the render-address shape and the stage message protocol to a documented contract (design D2)
- [x] 2.4 Prove the no-op: default-config rendered documents byte-identical before/after the extraction; full unit and e2e suites pass unchanged; the dogfooded showcase diffed
- [x] 2.5 Split `SnapshotProviders`: `providers.diff` stays a consumer override that wins; `providers.driver` becomes a deprecated alias routed to `domSubstrate({ driver })` (design D4)

## 3. Substrate-declared variant axes

- [x] 3.1 Implement axis declarations with the render/stage kind split; `domSubstrate()` declares the theme axis (render) and the viewport-width axis (stage) with today's ids and values (design D6)
- [ ] 3.2 Generalize `shell-core` routing/URL building and the chrome's variant controls to render the declared axes; keep `src/ui/test-ids.ts` as the locator vocabulary, keyed by axis id + value (design D9)
- [x] 3.3 Carry the substrate id and declared axes in the manifest; update manifest tests
- [x] 3.4 Accept declared render-axis parameters at the render endpoint (the theme parameter stays valid for the DOM substrate); shell and primer documents follow
- [ ] 3.5 Update the e2e chrome suite against the DOM substrate's declared axes; `bun run e2e` green

## 4. Check-phase delegation, baselines, and the render subcommand

- [ ] 4.1 Delegate the render-safety phase to `substrate.checks.safety`; add the `--safety` canonical flag with `--ssr` as a permanent alias; migrate this repo's scripts, hooks, and docs to `--safety` (design D8)
- [ ] 4.2 Delegate the a11y audit to `substrate.checks.audit` with not-applicable reporting for substrates that supply none
- [ ] 4.3 Delegate capture to `substrate.checks.capture` (default `serialize(render(...))`); the DOM substrate implements capture via its browser driver; substrate `diff` is the default under consumer overrides (design D4)
- [ ] 4.4 Re-key baselines to `<baselineDir>/<substrate.id>/<component>/<case>.<variantKey>.<ext>` with the DOM substrate reading the legacy flat path for one release and printing a migration hint (design D6)
- [x] 4.5 Add `display-case render <component>/<case>` printing the serialized frame to stdout (`--variant k=v` repeatable, `--out` optional), no server or browser required (design D12)
- [ ] 4.6 Delegate token conformance through the substrate with the DOM substrate supplying today's tokens check; unsupplied ⇒ reported not applicable

## 5. Publish pipeline

- [ ] 5.1 Bundle `stage.entry` into per-component render bundles; merge `stage.share` into the consumer's share list; make the always-shared rendering runtime substrate-declared (design D5)
- [ ] 5.2 Handle the static export per substrate capability: client-renderable substrates resolve un-pre-rendered variations via scripts; static-frame substrates identify them as unavailable
- [ ] 5.3 Cover the publish changes with unit tests and a publish e2e pass

## 6. Docs, skills, and release

- [ ] 6.1 Update README, `docs/` (configuration, checks, publishing, ai-agents), and `display-case.prompt.md` for the substrate key, declared axes, `--safety`, and the render subcommand
- [ ] 6.2 Redirect the bundled skills' capture steps (`display-case-snapshot`, `display-case-review`) through the render subcommand where a browser isn't needed
- [ ] 6.3 Post-change review: update `contributing/coding-best-practices.md`, `contributing/testing-best-practices.md`, and `contributing/NOTES.md` where the substrate seam changes guidance
- [x] 6.4 Add the changeset (minor: new public `substrate` config key, `./core` export, render subcommand; no breaking changes)
