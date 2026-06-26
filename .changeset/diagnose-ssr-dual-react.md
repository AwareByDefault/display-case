---
'@awarebydefault/display-case': minor
---

`check --ssr` now diagnoses a dual-React environment instead of blaming your
components. When the check's renderer resolves a different React instance than
your cases use (the classic `bunx @awarebydefault/display-case` run from a
directory that doesn't depend on the tool, which pulls a second React into a temp
prefix), every hook-using case used to throw `resolveDispatcher() … useState` and
get misreported as "can't render before scripts — move browser APIs into
effects/handlers, or declare the component `browserOnly`." That turned one
environment fault into hundreds of false "fix your component" findings.

The `ssr` check now detects the condition once — by runtime module identity, not
path — and reports a single environment fault that names **both** React copies
(path + version), classifies the cause (a `bunx`/temp install, a real version
conflict, or an un-deduped duplicate), and prescribes the exact fix, including the
nearest `package.json` to add the tool to. It explicitly steers you away from
component edits and `browserOnly`, and skips the per-case sweep that would only
manufacture false positives. A runtime-symptom safety net collapses the findings
even when the up-front probe can't run. Healthy single-React showcases — and
hook-free showcases that need no React — are unaffected.
