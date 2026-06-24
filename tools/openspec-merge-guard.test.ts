import { describe, expect, test } from 'bun:test'
import { findOffenders } from './openspec-merge-guard'

describe('findOffenders', () => {
  test('flags an added active proposal file', () => {
    expect(findOffenders('A\topenspec/changes/add-foo/proposal.md')).toEqual([
      'openspec/changes/add-foo/proposal.md',
    ])
  })

  test('flags a modified active proposal file', () => {
    expect(findOffenders('M\topenspec/changes/add-foo/tasks.md')).toEqual([
      'openspec/changes/add-foo/tasks.md',
    ])
  })

  test('allows additions under the archive', () => {
    const ns = 'A\topenspec/changes/archive/2026-06-24-add-foo/proposal.md'
    expect(findOffenders(ns)).toEqual([])
  })

  test('allows spec changes', () => {
    const ns = 'A\topenspec/specs/foo/spec.md\nM\topenspec/specs/bar/spec.md'
    expect(findOffenders(ns)).toEqual([])
  })

  test('allows deletions of an active proposal — the archive move', () => {
    const ns = [
      'D\topenspec/changes/add-foo/proposal.md',
      'D\topenspec/changes/add-foo/tasks.md',
      'A\topenspec/changes/archive/2026-06-24-add-foo/proposal.md',
      'A\topenspec/changes/archive/2026-06-24-add-foo/tasks.md',
    ].join('\n')
    expect(findOffenders(ns)).toEqual([])
  })

  test('reports only the offending paths in a mixed diff', () => {
    const ns = [
      'A\topenspec/changes/add-foo/proposal.md', // offender
      'D\topenspec/changes/add-bar/proposal.md', // deletion ok
      'A\topenspec/changes/archive/2026-06-24-x/spec.md', // archive ok
      'M\topenspec/specs/foo/spec.md', // spec ok
      'A\topenspec/config.yaml', // outside changes/ ok
    ].join('\n')
    expect(findOffenders(ns)).toEqual(['openspec/changes/add-foo/proposal.md'])
  })

  test('treats archive-prefixed paths as not active', () => {
    const ns = 'M\topenspec/changes/archive/2026-01-01-x/design.md'
    expect(findOffenders(ns)).toEqual([])
  })

  test('returns nothing for an empty or blank diff', () => {
    expect(findOffenders('')).toEqual([])
    expect(findOffenders('\n\n')).toEqual([])
  })
})
