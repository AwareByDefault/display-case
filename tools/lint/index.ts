#!/usr/bin/env bun
/**
 * Runs Display Case's custom *script* lint checks — project-specific rules that
 * need to scan non-JS files or string content (so they don't fit a Biome GritQL
 * plugin). Currently just `spec-purity`; each is a standalone script in this
 * directory (also runnable on its own). This runner spawns them, passes `--fix`
 * through, and aggregates the result.
 *
 * The AST-pattern rules (e2e locators, no inline <svg>) are Biome GritQL plugins
 * under this directory instead — they run inside `biome check`. Biome
 * (`bun run lint`), `tsc` (`bun run typecheck`), and Display Case's own
 * structure/tokens/ssr phases (`bun run check`) are the rest of the gate — see
 * contributing/linting-best-practices.md.
 *
 *   bun tools/lint/index.ts          # check
 *   bun tools/lint/index.ts --fix    # apply auto-fixes (spec-purity)
 */
import { resolve } from 'node:path'

const CHECKS = ['spec-purity'] as const

const FIX = process.argv.includes('--fix')
const here = import.meta.dir

const results = await Promise.all(
  CHECKS.map(async (name) => {
    const args = [resolve(here, `${name}.ts`)]
    if (FIX) args.push('--fix')
    const proc = Bun.spawn(['bun', ...args], {
      stdout: 'inherit',
      stderr: 'inherit',
    })
    const code = await proc.exited
    return { name, ok: code === 0 }
  }),
)

const failed = results.filter((r) => !r.ok)
if (failed.length > 0) {
  console.error(
    `\nlint:checks failed — ${failed.map((f) => f.name).join(', ')}`,
  )
  process.exit(1)
}
const n = CHECKS.length
console.log(`\nlint:checks passed (${n} check${n === 1 ? '' : 's'})`)
