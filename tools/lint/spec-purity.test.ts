import { describe, expect, test } from 'bun:test'
import { fixSpecText, scanSpecText } from './spec-purity'

describe('scanSpecText', () => {
  test('flags a forbidden stack name', () => {
    const v = scanSpecText('The renderer uses React to hydrate.')
    expect(v).toHaveLength(1)
    expect(v[0]).toMatchObject({ line: 1, kind: 'forbidden-term' })
    expect(v[0]?.message).toContain('React')
  })

  test('reports the 1-based line of the offending term', () => {
    const v = scanSpecText('clean line\nanother\nUses Docker here.')
    expect(v).toHaveLength(1)
    expect(v[0]?.line).toBe(3)
  })

  test('passes clean behavior prose', () => {
    const text = 'The server renders every surface before scripts run.'
    expect(scanSpecText(text)).toEqual([])
  })

  test('respects word boundaries (no substring matches)', () => {
    // "npmjs" (trailing word char) and "Reactive" must not trip npm / React.
    expect(scanSpecText('The npmjs registry and a Reactive design.')).toEqual(
      [],
    )
  })

  test('exempts fenced code blocks', () => {
    const text = ['```ts', 'import React from "react"', '```', 'Plain.'].join(
      '\n',
    )
    expect(scanSpecText(text)).toEqual([])
  })

  test('honors an inline allow escape', () => {
    const text = 'Mentions Docker. <!-- allow: infra example -->'
    expect(scanSpecText(text)).toEqual([])
  })

  test('flags a bolded scenario keyword', () => {
    const v = scanSpecText('  **GIVEN** a user')
    expect(v).toHaveLength(1)
    expect(v[0]).toMatchObject({ kind: 'bold-keyword', line: 1 })
  })

  test('accepts bullet-form scenario keywords', () => {
    expect(scanSpecText('- GIVEN a user')).toEqual([])
  })
})

describe('fixSpecText', () => {
  test('rewrites bolded keywords to bullet form, preserving indent', () => {
    expect(fixSpecText('  **WHEN** it runs')).toBe('  - WHEN it runs')
  })

  test('leaves bullet form and prose untouched', () => {
    const text = '- THEN it passes\nPlain line.'
    expect(fixSpecText(text)).toBe(text)
  })

  test('does not touch keywords inside code fences', () => {
    const text = ['```', '**GIVEN** literal', '```'].join('\n')
    expect(fixSpecText(text)).toBe(text)
  })

  test('cannot fix forbidden terms — left for the report', () => {
    expect(fixSpecText('Mentions Docker.')).toBe('Mentions Docker.')
  })
})
