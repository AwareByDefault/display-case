import { describe, expect, test } from 'bun:test'
import type { DisplayCaseConfig } from '../index'
import { makePrimerRenderer } from './ssr-primer'

const config: DisplayCaseConfig = { title: 'T', roots: [] }

describe('makePrimerRenderer', () => {
  test('renders the MDX content to markup', () => {
    const render = makePrimerRenderer(() => <h1>Primer Heading</h1>, config)
    const result = render()
    expect(result.browserOnly).toBe(false)
    expect(result.html).toContain('Primer Heading')
    expect(result.error).toBeUndefined()
  })

  test('falls the whole primer back to the client when a specimen needs a browser', () => {
    const render = makePrimerRenderer(() => {
      throw new Error('specimen touched window')
    }, config)
    const result = render()
    expect(result.browserOnly).toBe(true)
    expect(result.html).toBe('')
    expect(result.error).toContain('specimen touched window')
  })
})
