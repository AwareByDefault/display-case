#!/usr/bin/env bun
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { AGENT_TARGETS, DEFAULT_AGENT } from './commands/agents'
import { getManifest, startDisplayCase } from './server/server'

// Display Case is Bun-native at *runtime*, not just at install time: discovery,
// bundling, and serving all use Bun's built-in bundler and `Bun.serve`. Running
// the CLI under Node fails deep inside with an opaque `Bun is not defined`, so
// detect it up front and point the user at Bun.
if (typeof globalThis.Bun === 'undefined') {
  console.error(
    'display-case requires the Bun runtime (https://bun.sh).\n' +
      'Run it with Bun — e.g. `bunx @awarebydefault/display-case .` or `bun run display-case` — not Node.',
  )
  process.exit(1)
}

/**
 * Display Case CLI.
 *
 *   display-case <pkgDir> [--port=N]        start the dev server
 *   display-case <pkgDir> --print-manifest  print the manifest JSON and exit
 *   display-case check <pkgDir> [--a11y] [--visual] [--tokens] [--structure] [--ssr] [--graph] [--update] [--strict] [--only=ids] [--changed[=ref]] [--concurrency=N] [--port=N]
 *   display-case init <pkgDir> [--agent=claude] [--with-visual] [--dry-run] [--json]
 *   display-case uninstall <pkgDir> [--agent=claude] [--dry-run] [--json]
 *
 * With no phase flag, `check` runs all phases. Naming any phase flag runs only
 * the named phase(s) — e.g. `--tokens` runs the (browser-free) token check alone.
 * `init`/`uninstall` scaffold (or remove) AI-agent integration in the repo.
 */

const argv = process.argv.slice(2)

function flag(name: string): boolean {
  return argv.includes(`--${name}`)
}
function option(name: string): string | undefined {
  return argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1]
}
function positionals(): string[] {
  return argv.filter((a) => !a.startsWith('--'))
}

const CONFIG_FILE = 'display-case.config.ts'

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

/** Nearest ancestor of `start` (inclusive) containing a config, or null. */
function discoverConfigDir(start: string): string | null {
  let dir = resolve(start)
  for (let i = 0; i < 24; i++) {
    if (existsSync(join(dir, CONFIG_FILE))) return dir
    const parent = resolve(dir, '..')
    if (parent === dir) return null
    dir = parent
  }
  return null
}

/**
 * Resolve the package directory to operate on.
 *
 * - An explicit target (`display-case apps/foo`) is used as given and
 *   must contain a `display-case.config.ts` — a wrong directory fails loudly
 *   rather than serving an empty showcase.
 * - The default (no argument, or `.`) discovers the nearest config by walking up
 *   from the current directory, so it works from a package root *or* any
 *   subdirectory. The bare form is identical to `.` — there is no separate
 *   "no-argument" mode to reason about.
 *
 * Resolution, the `.display-case/` build cache, and repo-relative paths all
 * anchor to the resolved package, so running from a git worktree keeps
 * everything inside that worktree and two checkouts never share a cache. The
 * one rule: run it from inside the package (any depth), or pass the path
 * explicitly — don't rely on a process cwd that points elsewhere.
 */
function resolvePkgDir(arg: string | undefined): string {
  if (arg && arg !== '.') {
    const dir = resolve(arg)
    if (!existsSync(join(dir, CONFIG_FILE))) {
      fail(`No ${CONFIG_FILE} in ${dir} — is that a Display Case package?`)
    }
    return dir
  }

  const here = discoverConfigDir(process.cwd())
  if (here) return here
  fail(
    `No ${CONFIG_FILE} found in ${process.cwd()} or any parent directory.\n` +
      `Run from inside a Display Case package, or pass <pkgDir> explicitly.`,
  )
}

// An explicit `--port` wins; otherwise honor `DISPLAY_CASE_PORT` (the dev
// orchestrator sets this per-worktree so two checkouts don't collide), falling
// back to the server's own default. `startDisplayCase` treats the chosen port as
// preferred and bumps off a busy one, so this never hard-fails on a clash.
const portArg = option('port') ?? process.env.DISPLAY_CASE_PORT
const port = portArg ? Number(portArg) : undefined

if (argv[0] === 'init' || argv[0] === 'uninstall') {
  const pkgDir = resolve(positionals()[1] ?? '.')
  const agent = option('agent') ?? DEFAULT_AGENT
  if (!AGENT_TARGETS[agent]) {
    console.error(
      `Unsupported agent "${agent}". Supported: ${Object.keys(AGENT_TARGETS).join(', ')}.`,
    )
    process.exit(1)
  }
  const { runInit, runUninstall, report } = await import('./commands/init')
  // init may set up the visual toolchain: explicit --with-visual, or an
  // interactive prompt when attached to a TTY (never in --json/--dry-run).
  let withVisual = flag('with-visual')
  if (
    argv[0] === 'init' &&
    !withVisual &&
    process.stdin.isTTY &&
    !flag('json') &&
    !flag('dry-run')
  ) {
    const answer = prompt(
      'Set up visual-regression checking (Playwright + pixelmatch + pngjs)? [y/N]',
    )
    withVisual = /^y(es)?$/i.test(answer?.trim() ?? '')
  }
  const opts = {
    agent,
    dryRun: flag('dry-run'),
    json: flag('json'),
    withVisual,
  }
  const result = await (argv[0] === 'init' ? runInit : runUninstall)(
    pkgDir,
    opts,
  )
  report(result)
} else if (argv[0] === 'check') {
  const pkgDir = resolvePkgDir(positionals()[1])
  const { runChecks } = await import('./checks/check')
  const { resolveConfig } = await import('./core/discovery')
  const { config } = await resolveConfig(pkgDir)
  // A named phase flag ⇒ run only the named phase(s). With no phase flag, run
  // every phase except those a config opts out of via `check.defaultPhases`.
  const explicit = {
    tokens: flag('tokens'),
    a11y: flag('a11y'),
    visual: flag('visual'),
    structure: flag('structure'),
    ssr: flag('ssr'),
    graph: flag('graph'),
  }
  const anyExplicit =
    explicit.tokens ||
    explicit.a11y ||
    explicit.visual ||
    explicit.structure ||
    explicit.ssr ||
    explicit.graph
  const defaults = config.check?.defaultPhases ?? {}
  const runs = (phase: keyof typeof explicit): boolean =>
    explicit[phase] || (!anyExplicit && defaults[phase] !== false)
  // Change-scoping for the render phases (a11y/visual): `--only=<ids/globs>`
  // restricts to named components; `--changed[=<ref>]` restricts to components
  // whose import closure touches a file changed since <ref> (default the base
  // branch, overridable via DISPLAY_CASE_BASE_REF). Both are no-ops for the
  // static phases. See src/core/affected.ts.
  const onlyValue = option('only')
  const changedActive = flag('changed') || option('changed') !== undefined
  const ok = await runChecks(pkgDir, {
    a11y: runs('a11y'),
    visual: runs('visual'),
    tokens: runs('tokens'),
    structure: runs('structure'),
    ssr: runs('ssr'),
    graph: runs('graph'),
    update: flag('update'),
    strict: flag('strict'),
    only: onlyValue ? onlyValue.split(',').filter(Boolean) : undefined,
    changedRef: changedActive
      ? (option('changed') ??
        process.env.DISPLAY_CASE_BASE_REF ??
        'origin/main')
      : undefined,
    concurrency: (() => {
      const n = Number.parseInt(option('concurrency') ?? '', 10)
      return Number.isInteger(n) && n > 0 ? n : undefined
    })(),
    port,
  })
  process.exit(ok ? 0 : 1)
} else if (argv[0] === 'publish') {
  const pkgDir = resolvePkgDir(positionals()[1])
  const { publish } = await import('./commands/publish')
  const isStatic = flag('static')
  console.log('Building deployable showcase…')
  const { out } = await publish(pkgDir, {
    out: option('out'),
    base: option('base'),
    static: isStatic,
  })
  console.log(`\n  Published → ${out}`)
  console.log(
    isStatic
      ? '  Static export written — serve the directory with any static host.'
      : `  Run it:  (cd ${out} && bun install && bun server.ts)   — or build the Dockerfile.`,
  )
  process.exit(0)
} else {
  const pkgDir = resolvePkgDir(positionals()[0])

  if (flag('print-manifest')) {
    const manifest = await getManifest(pkgDir)
    console.log(JSON.stringify(manifest, null, 2))
    process.exit(0)
  }

  // `--dev` enables live reload of the Display Case app itself (chrome,
  // components, primer) — see StartOptions.dev.
  const server = await startDisplayCase(pkgDir, { port, dev: flag('dev') })
  console.log(`\n  Display Case → ${server.url}\n`)
}
