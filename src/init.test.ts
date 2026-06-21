import { describe, expect, test } from 'bun:test'
import { reconcilePointer } from './init'

// The sentinel contract reconcilePointer keys off of. Hardcoded here on purpose:
// the test pins the exact marker format that init writes and uninstall strips.
const START = '<!-- display-case:agent-guide:start -->'
const END = '<!-- display-case:agent-guide:end -->'
const block = (body: string) => `${START}\n## Display Case\n\n${body}\n${END}`

describe('reconcilePointer', () => {
  test('creates the block in an empty file', () => {
    const b = block('v1')
    const r = reconcilePointer('', b)
    expect(r.action).toBe('created')
    expect(r.next).toBe(`${b}\n`)
  })

  test('appends to existing content with a blank-line separator', () => {
    const b = block('v1')
    const r = reconcilePointer('# Project', b)
    expect(r.action).toBe('created')
    expect(r.next).toBe(`# Project\n\n${b}\n`)
  })

  test('normalizes to one blank line when content already ends in a newline', () => {
    const b = block('v1')
    const r = reconcilePointer('# Project\n', b)
    expect(r.action).toBe('created')
    expect(r.next).toBe(`# Project\n\n${b}\n`)
  })

  test('skips when the present block is byte-identical', () => {
    const b = block('v1')
    const current = `intro\n\n${b}\n`
    const r = reconcilePointer(current, b)
    expect(r.action).toBe('skipped')
    expect(r.next).toBe(current) // unchanged → runInit writes nothing
  })

  test('refreshes a drifted block in place', () => {
    const current = `intro\n\n${block('OLD wording')}\n`
    const next = block('NEW wording')
    const r = reconcilePointer(current, next)
    expect(r.action).toBe('updated')
    expect(r.next).toBe(`intro\n\n${next}\n`)
    expect(r.next).not.toContain('OLD wording')
  })

  test('replaces only the block, preserving text before and after', () => {
    const current = `before\n${block('OLD')}\nafter\n`
    const next = block('NEW')
    const r = reconcilePointer(current, next)
    expect(r.action).toBe('updated')
    expect(r.next).toBe(`before\n${next}\nafter\n`)
  })

  test('does not let a `$` in the block corrupt the replacement', () => {
    const current = block('OLD')
    const next = block('cost is $1 — see $& and $1 literally')
    const r = reconcilePointer(current, next)
    expect(r.next).toBe(next)
  })
})
