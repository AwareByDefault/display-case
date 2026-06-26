---
"@awarebydefault/display-case": patch
---

Start the dev/prod server listening before the initial build, so its `/health`
endpoint is reachable immediately instead of waiting on the cold build
subprocesses. Browse routes still serve the fully-prepared showcase (they await
the build), but a liveness check no longer blocks on it — which keeps Playwright's
`webServer` readiness check (and any hosting health probe) from timing out when
several servers boot at once on a constrained CI runner.
