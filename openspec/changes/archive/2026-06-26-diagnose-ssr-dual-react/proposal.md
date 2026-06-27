## Why

The `ssr` check renders every case **in-process**: the renderer (Display Case's
own `react-dom/server`, plus the wrapper tree) binds to the React resolved where
**Display Case** is installed, while each `*.case.tsx` and its hooks bind to the
React resolved relative to the **consumer package**. When those two installs
differ — the common case for `bunx @awarebydefault/display-case` run from a
directory that does not depend on the tool, which fetches it and its own React
peer into a throwaway temp prefix — there are *two* React instances.
`react-dom/server` arms one React's hook dispatcher; the consumer's components
read the other (null) dispatcher and **every hook-using case throws**
`resolveDispatcher() … useState`. Hook-free cases never touch the dispatcher, so
they pass and mask the cause.

The check is *correct* that "this render threw" but wrong about *why*: it records
each throw verbatim as a render-purity finding ("can't render before scripts …
move browser APIs into effects/handlers, or declare the component `browserOnly`")
and attributes it to the component's source. One environment fault is thereby
laundered into **hundreds of false "fix your component" findings** — a real
report saw ~250 across three showcases, all vanishing when the same check ran via
the workspace-installed binary (one React). Acting on the message would mean
rewriting ~250 cases or sprinkling `browserOnly` everywhere, defeating the point
of SSR coverage. `pinReact` already solves this exact dual-React problem — but
only for `Bun.build` bundles; the in-process `ssr` path does not bundle, so the
tool understands the failure mode in one place and is blind to it in another.

## What Changes

- **The `ssr` check detects the dual-React condition once and reports it as a
  single environment fault**, instead of N per-case render-purity findings. It
  probes — by **runtime module identity**, not path — whether the renderer's
  React is the same instance the cases use. On a proven split it emits one
  diagnosed finding and **skips the per-case sweep** (which would only
  manufacture false positives).
- **The diagnosis is deep and specific.** It names *both* React copies (resolved
  path + version), classifies *why* there are two — a `bunx`/temp throwaway
  install, a real version conflict, or an un-deduped duplicate of the same
  version — and prescribes the exact fix, including the **nearest ancestor
  `package.json` that already depends on `react`** as the concrete place to add
  Display Case. It explicitly steers the user *away* from component edits and
  `browserOnly`.
- **A runtime-symptom safety net** covers the case where the up-front probe is
  inconclusive (the consumer's React could not be imported, or the stamp did not
  take): when multiple cases all fail with the React null-dispatcher fingerprint,
  that all-identical distribution is itself the tell, and the findings collapse
  into one environment fault rather than per-component bugs.
- **No false positives on healthy showcases.** A showcase with one shared React
  (the workspace-installed norm) is untouched; a showcase of only hook-free cases
  (no React at all) is *not* a fault — an unresolved consumer React is treated as
  inconclusive, never as a finding.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `server-rendering`: the **Server-render safety check** requirement is broadened
  so the check distinguishes an **environment fault** — where the check's renderer
  and the cases resolve *different instances* of the shared component runtime they
  assume is singular, so no case can render for a reason that is environmental,
  not a property of any component — from genuine per-case render failures. Such a
  fault MUST be reported **once**, as a single diagnosed finding that identifies
  the conflicting copies and prescribes how to make them one, and MUST NOT be
  reported as a per-case failure for every affected case nor attributed to any
  component's source. A render failure not explained by such a fault is still
  reported per case as before.

## Impact

- **Affected code:** new `src/checks/react-identity.ts` (resolves both React
  copies, the runtime-identity probe, the cause classification, and the
  prescriptive diagnosis); `src/checks/ssr-check.ts` (runs the probe up front,
  skips the sweep on a proven fault, applies the runtime-symptom safety net,
  returns an optional `environment` fault on `SsrCheckResult`);
  `src/checks/check.ts` (reports the one environment fault in full and counts it
  as a single error, suppressing the per-case findings that were its symptom).
- **No public API or authoring change.** Addresses, the manifest, case authoring,
  and the published-build contract are unchanged. The fault is reporting-only;
  the per-case `ssr` behavior on a healthy (single-React) showcase is identical.
- **Performance:** one extra `react` resolution + a single dynamic `import` of the
  consumer's React on every `ssr` run (negligible); on a faulted run the whole
  per-case sweep is skipped, so it is strictly faster than today.
