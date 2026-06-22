import type { BunPlugin } from 'bun'

/**
 * Bun bundler plugin that pins every `react` / `react-dom` specifier to the
 * single copy installed in the **consumer** project (`pkgDir`).
 *
 * Why this is necessary: Display Case's own client runtime (`browser-entry`,
 * `render-mount`) statically imports `react-dom/client` and `react`, whose bare
 * specifiers resolve relative to **where Display Case itself is installed** —
 * while the consumer's `*.case.tsx` files and their deps resolve relative to the
 * **consumer project**. When those two installs differ (the common case for
 * `bunx @awarebydefault/display-case`, which installs the tool — and its peer
 * react/react-dom — into a temp prefix), the browser bundle ends up with *two*
 * React instances. `react-dom` drives one React's dispatcher; the consumer's
 * components read the other's (null) dispatcher → "Invalid hook call … more than
 * one copy of React", and every hook-using component blanks. Hook-free
 * components never touch the dispatcher, so they render and mask the bug.
 *
 * Forcing all react/react-dom resolution to `pkgDir` collapses the two copies to
 * one regardless of how the tool was invoked (bunx temp prefix, global install,
 * npx, pnpm's strict layout, hoisting differences). The renderer
 * (`createRoot`/`hydrateRoot`/`renderToString`) then binds to the same React the
 * consumer's components use.
 *
 * Resolve from `pkgDir`, NOT the package dir — the renderer must bind to the
 * React the consumer's components import, not Display Case's own.
 */
export function pinReact(pkgDir: string): BunPlugin {
  return {
    name: 'display-case-pin-react',
    setup(build) {
      // Matches `react`, `react-dom`, and their sub-paths (`react-dom/client`,
      // `react-dom/server`, `react/jsx-runtime`, `react/jsx-dev-runtime`) — but
      // not unrelated packages like `react-foo` or `@scope/react`.
      build.onResolve({ filter: /^(react|react-dom)(\/.*)?$/ }, (args) => {
        try {
          return { path: Bun.resolveSync(args.path, pkgDir) }
        } catch (cause) {
          throw new Error(
            `Display Case could not resolve "${args.path}" from ${pkgDir}. ` +
              'Install react and react-dom in the package you point Display Case at.',
            { cause },
          )
        }
      })
    },
  }
}
