import { defineConfig } from '@awarebydefault/display-case'

/**
 * Display Case dogfoods itself: it showcases its own design-system components
 * (the "Vitrine" library under src/ui/design-system/components/). Browse them
 * with `bun run display-case` (or `bun src/cli.ts .`).
 */
export default defineConfig({
  title: 'Display Case',
  roots: ['src/ui/design-system/components/**/*.case.tsx'],
  // Commit visual-regression baselines (instead of the gitignored default under
  // .display-case/) so the CI visual check has something to diff against. They
  // are recorded in the same Linux Playwright image CI renders in — see
  // scripts/record-baselines.ts and contributing/testing-best-practices.md — so
  // they don't drift on macOS↔Linux font-rendering differences.
  baselineDir: './test/visual-baselines',
  check: {
    // The committed baselines are Linux-recorded, so a bare `display-case check .`
    // on a developer's (likely non-Linux) machine would report dozens of false
    // pixel diffs. Opt `visual` out of the *default* run so local checks stay
    // green; it still runs when asked explicitly (`--visual`) and in CI, where
    // the visual job passes `--visual` inside the matching Linux container.
    // Record/refresh baselines with `bun run baselines:record` (also in-container).
    defaultPhases: { visual: false },
  },
  // Dogfood `share`: the placard/markdown panels render with `markdown-to-jsx`,
  // which several components pull into their browser bundles — `publish`'s duplicate
  // report flags it inlined across 6 of them. Sharing delivers it once as a cacheable
  // vendor bundle every surface resolves to via the importmap, instead of a copy per
  // per-component bundle. Affects only the published build, not `bun run display-case`.
  share: ['markdown-to-jsx'],
  // The Primer "wall text": a long-form reading page with embedded live
  // specimens, authored in MDX and dogfooding the design system's own components.
  primer: './src/ui/design-system/primer.mdx',
  // Land on the Primer (the default) — the wall text orients you before you
  // browse. Set 'components' or 'exhibits' to land on a catalog mode instead.
  landing: 'primer',
  // Dogfood the information-architecture config. The shell's page demos live
  // under `components/shell/`, so they derive the `shell` folder group; the
  // 'Primer to Cases' flow declares an explicit nested `group` (see its case),
  // giving a `Browse chrome › Walkthroughs` tree. Here we relabel the folder
  // group, exercising folder derivation + explicit `meta.group` + `nav.labels`.
  nav: {
    groups: {
      labels: { shell: 'Browse chrome' },
    },
  },
  // The server inlines the components' (dcui-*) CSS into every document; the
  // cases here only need the design system's --dc-* tokens + fonts so the
  // isolated /render doc resolves those custom properties. globalStyles are
  // concatenated verbatim (no @import resolution), so list the token files
  // individually rather than styles.css. fonts.css's @import is an absolute URL
  // and inlines fine.
  globalStyles: [
    './src/ui/design-system/tokens/fonts.css',
    './src/ui/design-system/tokens/colors.css',
    './src/ui/design-system/tokens/typography.css',
    './src/ui/design-system/tokens/spacing.css',
  ],
  tokens: {
    // Custom properties the package references but does not define as design
    // tokens: component-local theming vars (Button's --_bg/_fg/_bd), the
    // consumer-app tokens the render harness falls back to (server.ts/chrome.css
    // body), and the tokens-check's own example placeholder.
    allow: [
      '--_bg',
      '--_fg',
      '--_bd',
      '--color-bg',
      '--color-fg',
      '--font-sans',
      '--x',
    ],
  },
  // Surface accessibility results live in the browse chrome (dogfooding the
  // feature). Off by default for consumers — it needs the optional Playwright +
  // axe toolchain; when that's absent the panel shows an "unavailable" state and
  // the server still browses normally.
  a11y: {
    enabled: true,
    // Warm the nav's a11y markers from the on-disk cache at start-up without
    // scanning — the middle ground between usefulness and a fast boot. A
    // populated `.display-case/a11y/` surfaces verdicts across the whole nav
    // immediately; a fresh worktree (no cache folder) simply shows nothing and
    // still starts instantly, which keeps AI-agent boots cheap. 'refresh' would
    // re-scan every uncached/stale variant (slow on a cold worktree); 'off'
    // would show nothing until each variant is viewed.
    startup: 'cached',
  },
})
