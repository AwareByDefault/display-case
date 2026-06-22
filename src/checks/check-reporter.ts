/**
 * Pure formatting for the render-phase (a11y + visual) progress output. Models
 * each scanned variant as a "test" that passes or fails, in the shape of `bun
 * test`'s reporter — a `(pass)`/`(fail)` tag, a stable name, and a per-test
 * timing — so a CI log can be grepped and summarized the same way a test run is.
 *
 * Kept side-effect-free (no console, no I/O) so the formatting is unit-tested;
 * `check.ts` owns the timing (via `Bun.nanoseconds()`), the browser, and the
 * actual `console` writes.
 */

/** A single scanned variant under one phase — the unit that passes or fails. */
export type TestStatus = 'pass' | 'fail' | 'record'

const STATUS_TAG: Record<TestStatus, string> = {
  pass: '(pass)',
  fail: '(fail)',
  record: '(record)',
}

// Phase labels are padded to a common width so the `(pass)`/`(fail)` tags line
// up into a scannable column regardless of which phase emitted the line.
const PHASE_WIDTH = 6

/**
 * Human duration from a nanosecond span (`Bun.nanoseconds()` deltas), matching
 * `bun test`'s `[12.34ms]` / `[1.50s]` convention: milliseconds below a second,
 * seconds above.
 */
export function formatDuration(ns: number): string {
  const ms = ns / 1e6
  return ms < 1000 ? `${ms.toFixed(2)}ms` : `${(ms / 1000).toFixed(2)}s`
}

/**
 * One per-test line: `  a11y   (pass) Button/default [light] [12.34ms]`. The
 * `(pass)`/`(fail)`/`(record)` tag is fixed-text so a downstream summarizer can
 * count outcomes without parsing colour or glyphs.
 */
export function testLine(
  phase: string,
  name: string,
  status: TestStatus,
  durationNs: number,
): string {
  return `  ${phase.padEnd(PHASE_WIDTH)} ${STATUS_TAG[status]} ${name} [${formatDuration(durationNs)}]`
}

/** Per-phase pass/fail/recorded counts feeding the summary block. */
export interface PhaseTally {
  pass: number
  fail: number
  record: number
}

export function emptyTally(): PhaseTally {
  return { pass: 0, fail: 0, record: 0 }
}

/** Total tests a tally represents (recorded baselines count as run, not failed). */
function tallyTotal(t: PhaseTally): number {
  return t.pass + t.fail + t.record
}

/**
 * The closing summary, in `bun test`'s shape: a per-phase line, then the rolled-up
 * `N pass` / `N fail`, then a `Ran …` line carrying the total wall-clock (which is
 * less than the sum of per-test times when the phases run concurrently) and the
 * concurrency the run used.
 *
 * Returns the lines without the trailing canonical `✓ checks passed` verdict —
 * `check.ts` still prints that, so the overall pass/fail signal (and its exit
 * code) is unchanged.
 */
export function summaryLines(
  phases: { phase: string; tally: PhaseTally }[],
  totalNs: number,
  concurrency: number,
): string[] {
  const out: string[] = ['']
  let pass = 0
  let fail = 0
  let record = 0
  let total = 0
  for (const { phase, tally } of phases) {
    pass += tally.pass
    fail += tally.fail
    record += tally.record
    total += tallyTotal(tally)
    const parts = [`${tally.pass} pass`, `${tally.fail} fail`]
    if (tally.record) parts.push(`${tally.record} recorded`)
    out.push(`  ${phase.padEnd(PHASE_WIDTH)} ${parts.join('  ')}`)
  }
  out.push('')
  out.push(`  ${pass} pass`)
  out.push(`  ${fail} fail`)
  if (record) out.push(`  ${record} recorded`)
  out.push(
    `  Ran ${total} check${total === 1 ? '' : 's'} ` +
      `[${formatDuration(totalNs)}] (concurrency ${concurrency})`,
  )
  return out
}
