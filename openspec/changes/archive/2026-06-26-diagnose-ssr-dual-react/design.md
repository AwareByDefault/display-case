# Design — diagnose-ssr-dual-react

## The fault, precisely

`src/checks/ssr-check.ts` renders each case with `renderToString` imported from
Display Case's own `react-dom/server`, and the wrapper tree (`render-node`) uses
Display Case's own `react`. The cases import `react` relative to their own file
location (`pkgDir`). When Display Case and the consumer resolve **different**
`react` installs, `renderToString` arms *Display Case's* React's hook dispatcher,
and the consumer's components — calling hooks on the *other* React — read a `null`
dispatcher and throw `resolveDispatcher() … useState`. Hook-free cases never read
the dispatcher, so they pass and hide the cause.

This is the same class of hazard `pinReact` (`src/core/pin-react.ts`) fixes for
`Bun.build` bundles by forcing every `react`/`react-dom` specifier to resolve from
`pkgDir`. That plugin runs at **bundle** time; the `ssr` check renders
**in-process** and never bundles, so `pinReact` cannot apply to it.

## Why detect-and-diagnose rather than prevent in-process

True prevention (F in the source report) means binding the renderer to the
consumer's React. In-process that is **not** a swap of `renderToString` alone: the
wrapper tree (`StrictMode`, the configured decorator) is built from Display Case's
*statically imported* React, whose bare specifier is already bound at module load.
Rendering with the consumer's `react-dom/server` would arm the consumer's React
and break the *wrapper* instead of the cases — trading one dual-React failure for
another. Pinning Display Case's own React to `pkgDir` for an already-loaded static
import is not possible without re-running the sweep in a **separate process** with
resolution overridden (the worker route), which is a much larger, riskier change.

So this change makes the check **honest** about the fault rather than papering
over it: it converts ~N false "fix your component" findings into **one** precise,
prescriptive environment finding. The worker-based prevention is recorded as a
deferred follow-up (see Future work); the canary/identity machinery here is what
that follow-up would build on. The user-facing harm — a wall of misattributed
findings — is fully resolved by the diagnosis.

## Detection: runtime identity, not path

Path comparison is unreliable (symlinks, pnpm's layout, ESM/CJS dual-loads), so
the primary signal is **runtime module identity**:

1. Stamp the renderer's React (the statically imported `React`) with a
   non-enumerable `Symbol` property (`Object.defineProperty`, best-effort).
2. Resolve the consumer's React with `Bun.resolveSync('react', pkgDir)` and
   dynamically `import()` it.
3. The two are the **same instance** iff the consumer's React object carries the
   stamp.

A realpath comparison of the two resolved entry paths is the **fallback** when the
stamp could not be set or the consumer's React could not be imported. The result
is a tri-state `sameInstance: true | false | null`:

- `true` → one shared React → **no fault** (the healthy, workspace-installed norm).
- `false` → a proven split → **fault**; classify and report, skip the sweep.
- `null` → inconclusive (consumer React unresolved — e.g. a hook-free showcase
  that needs no React, or an import that threw) → **no up-front fault**; defer to
  the runtime symptom. An inconclusive probe never fabricates a fault.

## Classification — naming the cause and the fix

With both copies resolved (path + version) the split is classified:

- **`bunx-temp-install`** — the renderer's React resolved from a `bunx`/temp
  throwaway prefix (a `bunx-…` path segment, or anywhere under the OS temp dir via
  realpath). Cause: the tool is running from a throwaway install with its own
  React peer. Fix: add Display Case to the package that provides the cases' React.
- **`version-conflict`** — the two versions differ, so they are *necessarily*
  different instances. Fix: align/dedupe the versions (colocating the tool alone
  will not help while versions differ).
- **`duplicate-install`** — same version, different `node_modules`: an un-deduped
  duplicate. Fix: dedupe / install the tool where the cases' React lives.

The prescription names the **nearest ancestor `package.json` of `pkgDir` that
already declares a `react` dependency** (deps/devDeps/peerDeps) as the concrete
file to add `@awarebydefault/display-case` to, falling back to
`pkgDir/package.json`. Every message explicitly says these are *not* component
bugs and to *not* move code into effects or add `browserOnly`.

## Safety net — the runtime symptom

When `sameInstance === null` and the sweep nonetheless produces **≥2** findings
that **all** match the React null-dispatcher fingerprint (`resolveDispatcher`,
"Invalid hook call", "more than one copy of React", or the null-property-access
phrasing of a hook read in JSC/Bun and V8), the all-identical distribution is the
tell — real render-purity failures are sporadic and API-specific. The findings
collapse into one environment fault (`faultFromSymptom`), reusing the already
resolved paths/versions. A single such finding, or a mix with genuine browser-API
throws, is left as ordinary per-case findings — the collapse is conservative.

## Reporting

`SsrCheckResult` gains an optional `environment?: SsrEnvironmentFault` (the
classified fault plus a `skipped` count). When set, `findings` is empty and
`check.ts` prints the one `summary` line plus the indented `detail` block and
counts it as a **single** `ssr` error, suppressing the per-case message path. The
healthy and genuine-per-case-failure paths are unchanged.

## Generality

The hazard is the duplicate-singleton hazard (a package meant to exist once is
instantiated twice and the copies do not share module-scoped state), not
React-specific — the same shape hits React Context, `instanceof` across the
boundary, and module-scoped registries. React is the loud case the `ssr` check is
structurally exposed to, so this guard targets it; the identity-probe scaffolding
generalizes if another shared singleton ever needs the same treatment.

## Future work (deferred)

Bind the in-process sweep to the consumer's React by running it in a subprocess
whose `react`/`react-dom` resolution is pinned to `pkgDir` (the same guarantee
`pinReact` gives bundles), so the cases actually render under a dual-install
instead of only being diagnosed. Larger and riskier; this change ships the
diagnosis, which fully resolves the reported harm.
