## 1.0.2

### Patch Changes

- 81b924f: Fix duplicate-React in the browser bundle that broke hook-using components
  ("Invalid hook call … more than one copy of React"). Display Case's client
  runtime resolved `react`/`react-dom` from its own install while the consumer's
  cases resolved them from the project, so a `bunx` temp install pulled two React
  copies. A new `pinReact` bundler plugin forces every `react`/`react-dom`
  specifier to resolve from the consumer project, collapsing them to one copy
  across the dev browser, dev SSR, and publish browser builds.

## 1.0.1

### Patch Changes

- 4e1974a: Compile a consumer's Markdown/MDX primer against Display Case's own copy of
  `markdown-to-jsx`. The compiled primer is loaded from inside the consumer's tree,
  so the previously-emitted bare `import 'markdown-to-jsx'` resolved from the
  consumer — failing with `Could not resolve "markdown-to-jsx"` unless the consumer
  redeclared the dep. The plugin now resolves the package from Display Case's own
  install and emits an absolute path, so authoring a `primer.md`/`primer.mdx` no
  longer requires the consumer to add `markdown-to-jsx`.

# 1.0.0 (2026-06-22)

### Bug Fixes

- clear Biome CSS lint warnings in design-system stylesheets ([e012912](https://github.com/AwareByDefault/display-case/commit/e012912b876ca5e429bbba207c2c9df89f6cc7eb))
- use npm-normalized bin path so the CLI survives publish ([ce5a492](https://github.com/AwareByDefault/display-case/commit/ce5a492929e8f852fd585511444185de3fa73029))

### Features

- add a render-time CSS-in-JS style-engine seam ([e184cdc](https://github.com/AwareByDefault/display-case/commit/e184cdc11200c742d58e6ab24c80974cba8406ce))
- add mdx-lite, a dependency-free constrained-MDX to TSX compiler ([d4d64a0](https://github.com/AwareByDefault/display-case/commit/d4d64a081531d383edae786d2824b7ae778d3c93))
- extract Display Case into a standalone repository ([b9cd8ba](https://github.com/AwareByDefault/display-case/commit/b9cd8ba60bebf368a7ad2d26352d356bf10ba9d9))
- render markdown via markdown-to-jsx and mdx-lite, dropping the unified/MDX stack ([4770f7f](https://github.com/AwareByDefault/display-case/commit/4770f7fa013b48a9533373d816ac7d75f6ebf6b8))
- server-inline the Vitrine CSS ([c527490](https://github.com/AwareByDefault/display-case/commit/c52749049cfb1304bbf34e775c2a30793a1bb429))
- set up npm publishing as @awarebydefault/display-case ([6f4aca6](https://github.com/AwareByDefault/display-case/commit/6f4aca69639b8d6a35288190746eaf86490fef25)), closes [oven-sh/bun#30522](https://github.com/oven-sh/bun/issues/30522) [#24855](https://github.com/AwareByDefault/display-case/issues/24855)
