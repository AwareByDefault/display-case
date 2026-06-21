import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'
import type { DiffFn } from '../index'

/**
 * Built-in image diff: pixelmatch + pngjs. Imported lazily by the check runner
 * only when no custom diff is configured, so `pixelmatch` and `pngjs` stay
 * optional dependencies. A size mismatch counts as changed; otherwise any
 * differing pixel (above a small per-pixel threshold) counts as changed, and a
 * diff image is returned for the runner to write next to the baseline.
 */

const PER_PIXEL_THRESHOLD = 0.1
const DIFF_THRESHOLD = 0 // allowed differing pixels before a case counts as changed

export const pixelmatchDiff: DiffFn = ({ baseline, actual }) => {
  const a = PNG.sync.read(Buffer.from(baseline))
  const b = PNG.sync.read(Buffer.from(actual))
  if (a.width !== b.width || a.height !== b.height) {
    return { changed: true }
  }
  const diff = new PNG({ width: a.width, height: a.height })
  const mismatch = pixelmatch(a.data, b.data, diff.data, a.width, a.height, {
    threshold: PER_PIXEL_THRESHOLD,
  })
  if (mismatch > DIFF_THRESHOLD) {
    return { changed: true, mismatch, diffImage: PNG.sync.write(diff) }
  }
  return { changed: false, mismatch }
}
