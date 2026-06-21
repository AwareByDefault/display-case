import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { ImpactTag, impactRank } from './ImpactTag'

describe('impactRank', () => {
  test('orders the impacts worst-first', () => {
    expect(impactRank('critical')).toBeLessThan(impactRank('serious'))
    expect(impactRank('serious')).toBeLessThan(impactRank('moderate'))
    expect(impactRank('moderate')).toBeLessThan(impactRank('minor'))
  })

  test('sorts an unclassified (null) impact last', () => {
    expect(impactRank(null)).toBeGreaterThan(impactRank('minor'))
  })

  test('is usable as an Array.sort comparator', () => {
    const sorted = ['minor', 'critical', 'moderate', 'serious'].sort(
      (a, b) => impactRank(a as never) - impactRank(b as never),
    )
    expect(sorted).toEqual(['critical', 'serious', 'moderate', 'minor'])
  })
})

describe('ImpactTag', () => {
  test('labels the tag with the impact and grades it via data-impact', () => {
    const html = renderToStaticMarkup(<ImpactTag impact="critical" />)
    expect(html).toContain('data-impact="critical"')
    expect(html).toContain('title="Severity: critical"')
    expect(html).toContain('>critical<')
  })

  test('reflects each severity level', () => {
    expect(renderToStaticMarkup(<ImpactTag impact="minor" />)).toContain(
      'data-impact="minor"',
    )
    expect(renderToStaticMarkup(<ImpactTag impact="moderate" />)).toContain(
      'data-impact="moderate"',
    )
  })
})
