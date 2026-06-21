import { describe, expect, test } from 'bun:test'
import { PNG } from 'pngjs'
import type { CaseContext, DiffResult } from '../../index'
import { pixelmatchDiff } from './pixelmatch-diff'

// The built-in diff is identity-agnostic, but DiffFn requires the case context;
// pass a stub and treat the (synchronous) result as a resolved DiffResult.
const CTX: CaseContext & { baselinePath: string } = {
  componentId: 'button',
  caseId: 'default',
  theme: 'light',
  width: 320,
  baselinePath: 'baseline.png',
}
const diff = (baseline: Uint8Array, actual: Uint8Array): DiffResult =>
  pixelmatchDiff({ baseline, actual }, CTX) as DiffResult

/** A solid-colour PNG of the given size, encoded to file bytes. */
function solidPng(
  width: number,
  height: number,
  rgba: [number, number, number, number],
): Buffer {
  const png = new PNG({ width, height })
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = rgba[0]
    png.data[i + 1] = rgba[1]
    png.data[i + 2] = rgba[2]
    png.data[i + 3] = rgba[3]
  }
  return PNG.sync.write(png)
}

/** A white PNG with one pixel (0,0) flipped to black. */
function spottedPng(width: number, height: number): Buffer {
  const png = new PNG({ width, height })
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 255
    png.data[i + 1] = 255
    png.data[i + 2] = 255
    png.data[i + 3] = 255
  }
  png.data[0] = 0
  png.data[1] = 0
  png.data[2] = 0
  return PNG.sync.write(png)
}

describe('pixelmatchDiff', () => {
  test('reports no change for identical images', () => {
    const result = diff(
      solidPng(4, 4, [255, 255, 255, 255]),
      solidPng(4, 4, [255, 255, 255, 255]),
    )
    expect(result.changed).toBe(false)
    expect(result.mismatch).toBe(0)
  })

  test('reports a change with a count and a diff image when pixels differ', () => {
    const result = diff(solidPng(4, 4, [255, 255, 255, 255]), spottedPng(4, 4))
    expect(result.changed).toBe(true)
    expect(result.mismatch).toBeGreaterThan(0)
    expect(result.diffImage).toBeDefined()
    // The diff image is itself a valid PNG.
    expect(() =>
      PNG.sync.read(Buffer.from(result.diffImage as Uint8Array)),
    ).not.toThrow()
  })

  test('treats a size mismatch as changed without diffing pixels', () => {
    const result = diff(
      solidPng(4, 4, [255, 255, 255, 255]),
      solidPng(8, 8, [255, 255, 255, 255]),
    )
    expect(result.changed).toBe(true)
    expect(result.mismatch).toBeUndefined()
    expect(result.diffImage).toBeUndefined()
  })
})
