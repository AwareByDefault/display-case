## 1. React-identity diagnosis module

- [x] 1.1 Added `src/checks/react-identity.ts`: resolves both React copies
      (`Bun.resolveSync('react', …)` from the check's dir and from `pkgDir`),
      reads each version from its `react/package.json`, and detects same-vs-
      different instance by a stamped non-enumerable `Symbol` on the renderer's
      React (runtime identity), falling back to a realpath comparison.
- [x] 1.2 `classifyReactEnvironment` (pure): tri-state `sameInstance` →
      `bunx-temp-install` / `version-conflict` / `duplicate-install`, or `null`
      when there is one shared React or the split is unproven. Builds the deep
      `detail` (both paths+versions, cause, and the fix naming the nearest
      ancestor `package.json` that depends on `react`); steers away from
      component edits / `browserOnly`.
- [x] 1.3 `isReactDispatcherError` fingerprint (resolveDispatcher / invalid hook
      call / more than one copy / null-property hook read in JSC+V8 wording) and
      `faultFromSymptom` for the runtime-symptom fallback.

## 2. Wire into the `ssr` check

- [x] 2.1 `checkSsr` runs `diagnoseReactEnvironment(pkgDir)` up front; on a proven
      fault it returns `environment` and skips the per-case sweep (reporting the
      renderable count as `skipped`).
- [x] 2.2 Runtime-symptom safety net: if the probe was inconclusive yet ≥2
      findings all match the dispatcher fingerprint, collapse them into one
      `environment` fault.
- [x] 2.3 `SsrCheckResult` gains optional `environment?: SsrEnvironmentFault`
      (classified fault + `skipped`); `findings` is empty when it is set.

## 3. Reporting

- [x] 3.1 `check.ts` prints the single environment fault (`summary` + indented
      `detail` + a `skipped` line) and counts it as one `ssr` error, suppressing
      the per-case message path.

## 4. Verification

- [x] 4.1 `src/checks/react-identity.test.ts` — fingerprint matcher (dispatcher
      signatures vs genuine browser-API throws), every classification branch,
      no-fault paths (same instance / inconclusive / hook-free showcase), the
      nearest-dependant walk (deps/peerDeps/none).
- [x] 4.2 Existing `ssr-check.test.ts` still passes (hook-free showcase, a real
      browser-API finding, and `browserOnly` all unaffected — an unresolved
      consumer React is inconclusive, not a fault).
- [x] 4.3 Manual dual-React repro (a temp showcase with its own React install):
      version-conflict *and* same-version duplicate-install are both detected,
      the sweep is skipped, and the diagnosis names both copies and the fix.
- [x] 4.4 `bun run typecheck`, `bun run lint`, `bun test`, `bun run check` pass;
      the dogfood `ssr` check (single shared React) reports no false fault.
