# Coding Best Practices

This is the authoritative coding reference for the **Display Case** repo — the rules for writing and maintaining the library, the CLI, and the browse chrome. Rules are numbered for easy reference in code review. For tests see [testing-best-practices.md](testing-best-practices.md); for the lint/check inventory see [linting-best-practices.md](linting-best-practices.md); for the user-facing behaviour these rules support see the product docs under [../docs/](../docs/).

Display Case is a Bun-native, dependency-light tool: a TypeScript + React 19 library plus a CLI. It has **no backend, no database, no auth**. It is a development tool and a separately-deployed showcase artifact — it is **never bundled into a consuming application's build**.

---

## 1. TypeScript conventions

**1.1** `strict` is on (`tsconfig.json`). Do not weaken it per-file. No `any` in the public surface (`src/index.ts`); use `unknown` and narrow.

**1.2** **`verbatimModuleSyntax` is on.** A type-only import MUST use `import type`, and a type-only export `export type`. Mixing a value and a type in one `import { … }` when the type is only used as a type is an error. This keeps the emitted module graph honest — the bundler never pulls a module in just to read a type.

```ts
// Good
import type { ComponentType, ReactNode } from 'react'
import { useCallback, useEffect } from 'react'

// Bad — `ReactNode` is a type; verbatimModuleSyntax rejects the value import
import { ReactNode, useEffect } from 'react'
```

**1.3** **No non-null assertions (`!`).** Do not write `value!` to silence "possibly undefined". Narrow with a guard, throw an explicit error, or restructure so the value is provably present. A `!` is a lie to the type checker and the exact failure mode this tool exists to catch in rendered output.

**1.4** **Safe index access.** Treat any indexed access — `record[key]`, `array[i]`, `Object.entries`'d values — as possibly `undefined` and narrow before use. (`noUncheckedIndexedAccess` should be enabled in the tsconfig; even where the flag is off, write code as if it is.) Do not cast the `undefined` away.

```ts
// Bad — `T | undefined` masquerading as `T`
const step = (record as Record<string, FlowStep>)[name]
return step.render(ctx)

// Good — narrow, then use
const step = record[name]
if (!step) return notFoundStep
return step.render(ctx)
```

**1.5** Prefer `as const` arrays + derived unions over hand-written string unions, the way `HIERARCHY_LEVELS` drives `HierarchyLevel` in `src/index.ts`. One source of truth for the value list and its type.

**1.6** Discriminated unions are narrowed by their tag, never by casting. The tweak descriptors (`TweakDescriptor` in `src/index.ts`) discriminate on `kind`; check `kind` before reading kind-specific fields, and reconstruct the full variant object on a kind change rather than spreading unknowns.

---

## 2. Module & file structure

**2.1** Display Case is a **single-package repo**, not a Bun workspace. All TypeScript lives flat under `src/`, with a few sub-areas:

- `src/index.ts` — the **public authoring API** (`defineCases`, `defineFlow`, `tweak`, `defineConfig`, and the types case files and configs depend on). This is the package's published surface (`main`/`types`/`exports` in `package.json`).
- `src/cli.ts` — the CLI entrypoint (`bin`).
- `src/*.ts` — the engine: discovery, catalog, manifest, the dev server, the check phases (`structure-check.ts`, `tokens-check.ts`, `ssr-check.ts`), `init`/`publish`.
- `src/ui/` — the browse **chrome** (React 19 shell, hooks, the `/render` and primer mounts) and its design system under `src/ui/design-system/`.
- `src/checks/providers/` — the optional visual-regression backend (Playwright driver, pixelmatch diff).
- `docs/` — product docs · `e2e/` — Playwright e2e for the chrome · `skills/` — bundled agent skills.

**2.2** **Tests are colocated** as `*.test.ts` next to the module they cover (`discovery.ts` → `discovery.test.ts`). Type-level tests use `*.test-d.ts`. See [testing-best-practices.md](testing-best-practices.md).

**2.3** **`src/index.ts` is the contract.** Anything a case file or a `display-case.config.ts` imports must be exported here, and everything here must stay **pure data + thin helpers** — no DOM access, no server imports, no Node/Bun-only APIs. A case module is imported in two very different environments (the browser render bundle *and* the Bun server building the manifest), so the authoring API must be safe in both. Engine-internal modules (the server, discovery, the check runner) import freely from each other but are **not** re-exported from `index.ts`. Only `tokens-check` and `prod-server` have additional, deliberate `exports` subpaths.

**2.4** Keep pure logic separate from React. The chrome models this: `src/ui/shell-core.ts` holds pure, testable shell logic (URL parsing, grouping, sizing math), `src/ui/use-shell.ts` holds the hooks, and `src/ui/shell.tsx` is presentation. Pure functions get unit tests (`shell-core.test.ts`); the React layer stays thin.

---

## 3. Render purity & determinism

This is the central Display Case rule. Every surface — each isolated `/render/<component>/<case>`, the primer, and the published build — is **server-rendered to complete HTML before any script runs**, then the client *adopts* (hydrates) that markup. The server and client must produce **identical** output. The `ssr` check (`src/checks/ssr-check.ts`) enforces it by rendering every case on the server with no browser.

**3.1** **Keep render pure.** A case's render function (and the components it renders) MUST NOT, *during render*:

- read a clock or randomness: `Date.now()`, `new Date()`, `Math.random()`, `performance.now()`, `crypto.randomUUID()`;
- use locale/timezone-dependent formatting: `toLocaleString`, `Intl.*`, `toLocaleDateString` with the ambient locale;
- touch a browser-only API: `window`, `document`, `localStorage`, layout measurement (`getBoundingClientRect`, `offsetWidth`), `canvas`, media queries.

These either mismatch on adopt (the client re-renders and logs `adopt mismatch`) or throw on the server. They also make a case a poor snapshot subject — the same URL must produce the same pixels.

**3.2** **Browser APIs belong in effects and handlers, not render.** `useEffect`, `useLayoutEffect`, and event callbacks run only on the client, after adopt — `window`/layout/canvas access there is correct and the `ssr` check does not flag it. The `ssr` check is deliberately *not* a static "no browser APIs" lint precisely so legitimate effect/handler usage is allowed.

**3.3** **Pass non-deterministic values in as fixed tweaks.** A case that needs a date, an id, or a random-looking value supplies it as a `tweak` (or a hardcoded literal) so it is fixed and URL-encoded — reproducible across server and client and across snapshots.

```tsx
// Bad — different markup on server vs client; "adopt mismatch"
Now: () => <Timestamp value={Date.now()} />

// Good — fixed, deterministic, snapshottable
Now: () => <Timestamp value={1_700_000_000_000} />
```

**3.4** **`browserOnly: true` is the only opt-out.** A component that genuinely cannot render without a browser declares `browserOnly: true` in its case meta (`CaseMeta` in `src/index.ts`). Display Case then renders it on the client wherever it appears, and the `ssr` check treats it as expected rather than a failure. Reach for this last — prefer moving browser access into an effect (§3.2). A case that simply *throws* under server rendering also falls back automatically (the surrounding surface is unaffected and the console logs which case fell back), but an undeclared throw is a latent bug, not a sanctioned pattern.

---

## 4. Case-authoring coding rules

These govern `*.case.tsx` files. The authoring API and prose live in [../docs/writing-cases.md](../docs/writing-cases.md) and [../display-case.prompt.md](../display-case.prompt.md); the rules below are the load-bearing coding constraints.

**4.1** **No side effects at case-module top level.** Render functions are lazy thunks. The server imports every case module to build the manifest **without calling render** — so do not run hooks, fetch, read the DOM, or do any work at module top level. Need state? Define a small component above the export and reference it from the thunk (`Controlled: () => <MyDemo />`).

**4.2** **A stateful wrapper reused across ≥2 cases needs a distinct `key` per case.** The browse chrome swaps cases **in place** — it re-renders one persistent React root and never unmounts (so theme/tweak changes don't flicker). React then sees the same `<Demo>` at the same tree position across cases and **keeps its `useState` value** instead of re-seeding from each case's props, surfacing the previous case's selection (or none). Give each usage a distinct `key` so React remounts it. The `interactive-cases-keyed` structure check enforces this; waive a deliberate exception with `// display-case: allow-interactive-cases-keyed <reason>`.

```tsx
function Demo({ options, initial }: { options: Opt[]; initial: string }) {
  const [value, setValue] = useState(initial)
  return <Toggle options={options} value={value} onChange={setValue} />
}

export default defineCases('Toggle', {
  Two:  () => <Demo key="two"  options={two}  initial="b" />,
  Five: () => <Demo key="five" options={five} initial="lg" />,
})
```

A tweaked `Playground` that re-seeds from a tweak follows the same rule — key it by the seeding tweak (`key={`pg-${t.count}`}`). A specimen used in only one case is safe.

**4.3** **First case = default landing variant.** Insertion order is preserved, and clicking a component opens its first case. Lead with the most exploratory variant (a tweaked `Playground` or a do-anything demo); keep isolated single-state variants (`Disabled`, `With error`) after it — those exist mainly for snapshots and visual regression.

**4.4** **One component (or flow) per file**, default-exported. A file with no valid default export, or whose `component` is not a string, is skipped and reported as a load error. Coverage tooling expects a `<name>.case.tsx` sibling per showcased component (`case-placard-coverage`); exempt a non-visual module with `// display-case: no-case <reason>`.

**4.5** **Keep flow views pure.** A `defineFlow` step wires its injected `goto` into a presentational view's callbacks; the view itself imports no navigation, so the same view is reusable elsewhere. `transitions` is the declared, static-analysable flow graph — keep it in sync with the imperative `goto` calls (`flow-transitions-resolve`).

---

## 5. Design-token discipline ("The Vitrine")

The browse chrome has its **own** design system — *The Vitrine* — under `src/ui/design-system/`, so the chrome never borrows the showcased package's tokens and the showcased component owns the visual weight.

**5.1** **Chrome styles reference only `--dc-*` tokens.** `chrome.css` is styled entirely from the Vitrine token layer (`src/ui/design-system/tokens/`: colours, typography, spacing). Do not hardcode colours/spacing in the chrome and do not reach for a consumer or host-app token name. The server inlines the token layer ahead of `chrome.css`.

**5.2** **Every `var(--token)` must resolve to a token the package defines.** The `tokens` check (`src/checks/tokens-check.ts`) statically parses `var()` references and flags any whose custom property is defined nowhere the package controls (in `globalStyles` or an inline `style` object). This catches foreign or typo'd names that silently fall back to a hardcoded value.

**5.3** The rule is **vocabulary conformance, not CSS validity** — `var(--x, fallback)` is still flagged even though the fallback makes it valid CSS. Do not add a fallback to dodge the check; use the right token.

**5.4** Escape hatches, used sparingly: a per-reference `/* allow: unknown-token */` comment, or list genuinely host-app-provided tokens under `tokens.allow` in the config.

**5.5** **Component CSS is a co-located `.css` file, inlined server-side — never runtime-injected.** Each Vitrine component keeps its `dcui-*`/`dcpl-*` rules in a sibling stylesheet (`Button.tsx` → `Button.css`); the component module carries **no** `const CSS` blob and does **not** touch `document` to paint. `readVitrineCss()` (in `server.ts`, mirrored in `publish.ts`) reads-and-concatenates `chrome.css` + every `components/**/*.css` + `primer.css` in path-sorted order into one **Vitrine stylesheet** that the server inlines into every document `<style>` before scripts run — so §3 (render before scripts) holds for styling, not just markup. Do **not** reintroduce a runtime style-injection helper; a component that paints only after hydration is the FOUC bug this replaced. Keep selectors fully `.dc-*`/`.dcui-*`/`.dcpl-*`-prefixed (no bare `html/body/:root` rules) so the blob is safe to inline into the chrome-free `/render` doc without drifting a consumer's snapshots.

---

## 6. Import boundaries & dependencies

**6.1** **No consuming-app imports, ever.** Display Case is a standalone tool. The package must never import from a package it showcases (e.g. `../ui`) in shipped code, and it is never bundled into a consuming app's build. A consumer points the CLI at *its* package; Display Case discovers and bundles the consumer's case files at runtime — it does not depend on them at build time.

**6.2** **Stay dependency-light.** Keep `dependencies` minimal (today: `markdown-to-jsx` for all Markdown rendering, and the file watcher — the `.mdx` Primer is compiled by the in-repo `mdx-lite`, not a third-party MDX stack). Prefer Bun built-ins (`Bun.serve`, `Bun.build`, `Bun.Glob`, `Bun.file`) and `node:*` over third-party packages. Adding a runtime dependency is a deliberate decision, not a convenience.

**6.3** **The visual toolchain is optional and lazily loaded.** `playwright`, `@axe-core/playwright`, `pixelmatch`, and `pngjs` are `optionalDependencies` and MUST be imported only when a default-backed `check --a11y`/`--visual` (or the live a11y surface) actually runs — via dynamic `import()` inside `src/checks/providers/`, never at module top level. Browsing, `--print-manifest`, `/render` snapshotting, `init`, and the three static check phases (`structure`, `tokens`, `ssr`) must work with none of them installed.

**6.4** **The authoring API stays environment-neutral** (see §2.3): `src/index.ts` imports no DOM, no server, no Node/Bun runtime globals — only `react` types.

---

## 7. Error handling

**7.1** This is a CLI and a dev server, so **fail loudly and early at the boundary.** A missing config, a wrong target directory, or an unsupported `--agent` must error with an actionable message and a non-zero exit — never serve an empty showcase silently. (Discovery already does this: a wrong `<pkgDir>` "fails loudly rather than serving an empty showcase".)

**7.2** **Isolate per-case failures.** One case that throws under server rendering must not take down the surface: catch it, deliver that case's document empty, let the client render it, and log which case fell back (§3.4). The same posture applies to a case module that fails to load — report it as a load error and keep loading the rest.

**7.3** Throw `Error` with a clear, contextual message (include the offending file/target). Do not throw strings or bare values. Let unexpected programmer errors propagate; only catch where you can add value (a fallback, a better message, a clean exit).

**7.4** `check` and `cli` communicate success/failure through the **process exit code** — non-zero on any failing phase or fatal error. Don't swallow a failure into a zero exit.

---

## 8. Logging & console discipline

**8.1** This is a developer-facing tool, so **`console` IS the UI** — unlike a server app, deliberate `console.*` is expected and correct. Use it intentionally: startup banners, the resolved URL, which case fell back to client render, an `adopt mismatch`, a token violation.

**8.2** **Be quiet on the happy path, loud on the actionable.** Don't log per-request noise during normal browsing. Reserve output for things the author should act on (a render fallback, a missing toolchain, a structure/token finding) or genuinely useful state (server up at URL, rebuild complete).

**8.3** **Machine-readable when asked.** Commands with a `--json` flag (e.g. `init`/`uninstall`) must emit only the structured JSON payload on stdout — no decorative human text mixed in — so an agent can consume it.

**8.4** Diagnostics that aren't part of normal output go to `console.warn`/`console.error` (stderr), keeping stdout clean for the primary result (a manifest dump, a JSON plan).

---

## 9. React 19 component patterns (the chrome)

These apply to the browse chrome under `src/ui/` (the shell, the render/primer mounts, hooks). The showcased components belong to consumers and follow their own conventions.

**9.1** **Hydration-safe by construction.** The chrome is server-rendered and adopted, so every chrome component obeys §3: no clock/random/locale/browser access during render. Browser-only work (measuring the panel, reading the URL, wiring listeners) lives in `useEffect`/`useLayoutEffect` or handlers.

**9.2** **Separate pure logic, hooks, and presentation** (§2.4): pure functions in `*-core.ts` (unit-tested), hooks in `use-*.ts`, JSX in `*.tsx`. A component that grows non-trivial logic should push that logic into a pure helper.

**9.3** **Hooks correctly and minimally.** Respect the rules of hooks (top level, unconditional). Memoize derived data and stabilize callbacks with `useMemo`/`useCallback` where it matters for re-render or effect-dependency correctness — not reflexively. Effects must declare honest dependency arrays and clean up listeners/observers/timeouts they create.

**9.4** **The case root is swapped in place** (§4.2). The chrome re-renders one persistent React root rather than unmounting between cases. Keep that mount logic in one place (the render mount) and respect identity/`key` semantics; the decorator is applied inside `StrictMode`.

**9.5** **Locators are `data-testid`s** from `src/ui/test-ids.ts`, not class names or text. The e2e suite (`e2e/`) targets these. Add a test id when you add a surface the e2e suite needs to reach — see [testing-best-practices.md](testing-best-practices.md) and [../docs/testing.md](../docs/testing.md).

**9.6** **Components are typed React 19 function components** — no class components, props typed explicitly (no implicit `any`), `children` as `ReactNode`. Match the existing `import type { … } from 'react'` style (§1.2).
