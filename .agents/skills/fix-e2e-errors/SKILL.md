---
name: fix-e2e-errors
description: >
  Review Playwright e2e failures by reading error-context.md files in
  test-results/, diagnose each failure, and fix the test or the browse-chrome
  code. Use when the user says "fix e2e errors", "fix e2e failures",
  "review e2e results", or invokes /fix-e2e-errors.
---

# fix-e2e-errors

Review and fix Playwright e2e failures from the last test run of the Display Case
browse chrome.

## Steps

1. **Find failures** — glob `test-results/**/error-context.md`. If none exist, report "No error-context.md files found — all tests passed or suite hasn't run yet."

2. **Read each file** — each `error-context.md` contains:
   - Test name + location
   - Error message + stack
   - Page snapshot (ARIA tree of the page at failure)
   - Test source with the failing line marked `>`

3. **Diagnose** — before touching any code, determine whether the bug is in:
   - **The test** — wrong testid, wrong assertion, stale URL, wrong expected value
   - **The chrome** — the shell/server doesn't render what the test expects (manifest shape, render endpoint, primer, a11y panel, …)

   Read the actual source files referenced in the error (the spec under `e2e/`, the chrome under `src/ui/`, or the server under `src/`) to confirm your diagnosis before writing a fix.

4. **Fix** — make the minimal change that makes the test correct:
   - Test bug → edit the spec file (locators come from `src/ui/test-ids.ts`)
   - Chrome/server bug → edit the source (and update the test if also wrong)
   - Never widen assertions to hide a real bug
   - Never add `waitForTimeout` / sleep — find the actual race

5. **Report** — after all fixes, list each failure with one line: file, problem, what you changed.

## Rules

- Fix root causes. Don't silence errors or loosen assertions to paper over bugs.
- Read the page snapshot — it shows what was actually rendered, which usually reveals the mismatch immediately.
- Multiple failures in one run may share a root cause — check before fixing each independently.
- Do not delete test-results artifacts; Playwright manages them.
