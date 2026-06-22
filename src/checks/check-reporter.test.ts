import { describe, expect, test } from 'bun:test'
import {
  emptyTally,
  formatDuration,
  summaryLines,
  testLine,
} from './check-reporter'

const MS = 1e6
const SEC = 1e9

describe('check-reporter: formatDuration', () => {
  test('sub-second spans render as milliseconds with two decimals', () => {
    expect(formatDuration(12.345 * MS)).toBe('12.35ms')
    expect(formatDuration(0)).toBe('0.00ms')
  })

  test('spans of a second or more render as seconds', () => {
    expect(formatDuration(SEC)).toBe('1.00s')
    expect(formatDuration(3.456 * SEC)).toBe('3.46s')
  })
})

describe('check-reporter: testLine', () => {
  test('a pass carries the (pass) tag, name, and timing', () => {
    expect(testLine('a11y', 'Button/default [light]', 'pass', 12.34 * MS)).toBe(
      '  a11y   (pass) Button/default [light] [12.34ms]',
    )
  })

  test('phases pad to a common width so tags align', () => {
    const a = testLine('a11y', 'X/y [light]', 'fail', MS)
    const v = testLine('visual', 'X/y [light]', 'fail', MS)
    expect(a.indexOf('(fail)')).toBe(v.indexOf('(fail)'))
  })

  test('a recorded baseline carries the (record) tag', () => {
    expect(testLine('visual', 'X/y [dark]', 'record', MS)).toContain('(record)')
  })
})

describe('check-reporter: summaryLines', () => {
  test('rolls up per-phase tallies, totals, and wall-clock', () => {
    const a11y = { ...emptyTally(), pass: 43, fail: 1 }
    const visual = { ...emptyTally(), pass: 42, fail: 2, record: 3 }
    const lines = summaryLines(
      [
        { phase: 'a11y', tally: a11y },
        { phase: 'visual', tally: visual },
      ],
      2.5 * SEC,
      4,
    )
    const text = lines.join('\n')
    expect(text).toContain('a11y   43 pass  1 fail')
    expect(text).toContain('visual 42 pass  2 fail  3 recorded')
    // 43+1 + 42+2+3 = 91 checks; 85 pass / 3 fail overall.
    expect(text).toContain('  85 pass')
    expect(text).toContain('  3 fail')
    expect(text).toContain('Ran 91 checks [2.50s] (concurrency 4)')
  })

  test('a single check is not pluralized', () => {
    const lines = summaryLines(
      [{ phase: 'a11y', tally: { ...emptyTally(), pass: 1 } }],
      MS,
      1,
    )
    expect(lines.join('\n')).toContain('Ran 1 check [')
  })
})
