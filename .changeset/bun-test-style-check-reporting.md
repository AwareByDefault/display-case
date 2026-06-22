---
"@awarebydefault/display-case": minor
---

Report the `display-case check` a11y and visual-regression phases like `bun test`.
Every variant is now a "test" with a `(pass)` / `(fail)` / `(record)` tag and its
own elapsed time (`Bun.nanoseconds()`), followed by a rolled-up summary — per-phase
counts, the overall `N pass` / `N fail`, and a `Ran N checks [wall-clock]
(concurrency K)` line. The fixed-text tags carry no colour or glyphs, so a CI step
can grep and tally them the same way it summarizes a test run.

Variants now scan concurrently (default 4) instead of serially, each on its own
page from the shared browser, cutting wall-clock well below serial. Tune it per run
with `--concurrency=N` or globally with `check.concurrency`. The overall verdict and
0/1 exit code are unchanged, so it remains a drop-in CI gate.
