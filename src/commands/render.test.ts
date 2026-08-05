import { describe, expect, test } from 'bun:test'
import { renderCase } from './render'

/**
 * `display-case render` is the browserless capture path, so these run against
 * this repo's own showcase (it dogfoods Display Case) and assert the thing that
 * matters: real component markup comes out, with no server and no browser
 * started anywhere in the call.
 */

const PKG = new URL('../..', import.meta.url).pathname.replace(/\/$/, '')

const render = (
  target: string,
  over: Partial<Parameters<typeof renderCase>[1]> = {},
) => renderCase(PKG, { target, variants: [], tweaks: [], ...over })

describe('display-case render', () => {
  test('prints a case as serialized bytes with the substrate extension', async () => {
    const result = await render('button/variants')
    const text = new TextDecoder().decode(result.bytes)
    expect(result.browserOnly).toBe(false)
    expect(result.ext).toBe('html')
    expect(text).toContain('dcui-btn')
    expect(text).toContain('Primary')
  })

  test('fills unspecified render axes from their declared defaults', async () => {
    const result = await render('button/variants')
    expect(result.variants).toEqual({ theme: 'light' })
  })

  test('honors an explicit render-axis value', async () => {
    const result = await render('button/variants', {
      variants: ['theme=dark'],
    })
    expect(result.variants.theme).toBe('dark')
  })

  test('applies tweak values to the rendered frame', async () => {
    // The playground case exposes a `label` text tweak; the frame must reflect
    // it, because that is what makes a tweaked address reproducible from the
    // command line as well as from the browser.
    const result = await render('button/playground', {
      tweaks: ['label=Salutations'],
    })
    expect(new TextDecoder().decode(result.bytes)).toContain('Salutations')
  })

  test('rejects a target that is not <component>/<case>', async () => {
    expect(render('button')).rejects.toThrow(/Expected <component>\/<case>/)
  })

  test('names the known cases when the case id is wrong', async () => {
    // The error has to be actionable without a second command.
    expect(render('button/nope')).rejects.toThrow(/Known cases:.*variants/)
  })

  test('rejects an unknown component by name', async () => {
    expect(render('nosuchthing/x')).rejects.toThrow(
      /No component "nosuchthing"/,
    )
  })

  test('rejects a malformed variant pair', async () => {
    expect(render('button/variants', { variants: ['theme'] })).rejects.toThrow(
      /Malformed --variant/,
    )
  })
})
