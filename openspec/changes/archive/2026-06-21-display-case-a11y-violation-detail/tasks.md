## 1. Violation model (mechanism-neutral)

- [x] 1.1 Add `A11yNodeDetail` + `A11yContrast` to the shared contract (`src/index.ts`); add optional `details?: A11yNodeDetail[]` to `A11yViolation`; document that it is populated where the audit mechanism provides it
- [x] 1.2 Populate `details` in the built-in mechanism (`src/providers/playwright-driver.ts`): map each axe node to `{ target, html, failureSummary }`, and the `color-contrast` check's `data` to `A11yContrast`

## 2. Gate output + persistence

- [x] 2.1 Add the pure `a11yDetailLines(v)` formatter and print it under each violation in `src/check.ts` (capped inline list, "+N more" note)
- [x] 2.2 Accumulate failing variants and write `.display-case/a11y/last-check.json` (`{ scannedAt, total, results }`), overwritten each run, empty on a clean run; print a pointer to it

## 3. Verification + docs

- [x] 3.1 Unit-test `a11yDetailLines` (contrast pair, non-contrast summary, cap + remainder, no-detail) in `src/check.test.ts`
- [x] 3.2 Verify end-to-end: a reintroduced contrast failure prints the element + measured/required pair and is written to the report; revert
- [x] 3.3 Update docs (`docs/testing.md`, `docs/ai-agents.md`, `docs/cli.md`) for the per-node detail and the `last-check.json` report
- [x] 3.4 Run the full lint + test gate
