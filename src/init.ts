import { existsSync } from 'node:fs'
import { mkdir, readdir, rm } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import type { AgentTarget } from './agents'
import { AGENT_TARGETS } from './agents'

/**
 * Scaffolds (and removes) Display Case's AI-agent integration in a target repo.
 * Every write is idempotent and merge-aware; every removal is owns-only —
 * artifacts are identified the same way they are written (a fixed launch
 * `name`, the bundled skill ids, and sentinel-delimited instruction markers),
 * so the two commands stay in lock-step without an install manifest.
 */

const PKG_ROOT = resolve(import.meta.dir, '..')
const SKILLS_SRC = join(PKG_ROOT, 'skills')
const PROMPT_FILE = join(PKG_ROOT, 'display-case.prompt.md')

const LAUNCH_NAME = 'display-case'
const SENTINEL_START = '<!-- display-case:agent-guide:start -->'
const SENTINEL_END = '<!-- display-case:agent-guide:end -->'

export type Action = 'created' | 'updated' | 'skipped' | 'removed'

export interface PlanItem {
  artifact: string
  action: Action
  detail?: string
}

export interface RunOptions {
  agent: string
  dryRun: boolean
  json: boolean
  /** init only: also set up the default visual-regression toolchain. */
  withVisual?: boolean
}

const VISUAL_PACKAGES = [
  'playwright',
  '@axe-core/playwright',
  'pixelmatch',
  'pngjs',
]

async function setupVisualToolchain(repoRoot: string): Promise<void> {
  const run = async (cmd: string[]) => {
    const proc = Bun.spawn(cmd, {
      cwd: repoRoot,
      stdout: 'inherit',
      stderr: 'inherit',
    })
    const code = await proc.exited
    if (code !== 0)
      throw new Error(`\`${cmd.join(' ')}\` failed (exit ${code})`)
  }
  await run(['bun', 'add', '--dev', ...VISUAL_PACKAGES])
  await run(['bunx', 'playwright', 'install', 'chromium'])
}

export interface RunResult {
  command: 'init' | 'uninstall'
  agent: string
  dryRun: boolean
  json: boolean
  items: PlanItem[]
}

function findRepoRoot(start: string): string {
  let dir = start
  for (let i = 0; i < 12; i++) {
    if (existsSync(join(dir, '.git'))) return dir
    const parent = resolve(dir, '..')
    if (parent === dir) break
    dir = parent
  }
  return start
}

async function bundledSkillIds(): Promise<string[]> {
  if (!existsSync(SKILLS_SRC)) return []
  const entries = await readdir(SKILLS_SRC, { withFileTypes: true })
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
}

async function readJson(path: string): Promise<Record<string, unknown> | null> {
  if (!(await Bun.file(path).exists())) return null
  return JSON.parse(await Bun.file(path).text()) as Record<string, unknown>
}

function resolveInstructionsFile(
  repoRoot: string,
  target: AgentTarget,
): string {
  const found = target.instructionsFiles.find((f) =>
    existsSync(join(repoRoot, f)),
  )
  return join(repoRoot, found ?? target.instructionsFiles[0])
}

function launchEntry(repoRoot: string, pkgDir: string) {
  const cliRel = relative(repoRoot, join(PKG_ROOT, 'src', 'cli.ts'))
  const showcaseRel = relative(repoRoot, pkgDir)
  return {
    name: LAUNCH_NAME,
    runtimeExecutable: 'bun',
    // `--dev` enables watching Display Case's own chrome (not just the showcased
    // package), so editing the shell hot-reloads even when `showcaseRel` points
    // elsewhere. It's a no-op when showcasing Display Case itself.
    runtimeArgs: [cliRel, showcaseRel, '--port=3100', '--dev'],
    port: 3100,
  }
}

function guideBlock(repoRoot: string): string {
  const promptRel = relative(repoRoot, PROMPT_FILE)
  const docsRel = relative(repoRoot, join(PKG_ROOT, 'docs', 'ai-agents.md'))
  return [
    SENTINEL_START,
    '## Display Case (for agents)',
    '',
    'Browse the component showcase with `bun run display-case`; `--print-manifest` lists every component/case as JSON.',
    'Snapshot one case in isolation at `/render/<component>/<case>?theme=light|dark` (chrome-free HTML).',
    `See [${promptRel}](${promptRel}) for authoring and [${docsRel}](${docsRel}) for the agent workflow.`,
    SENTINEL_END,
  ].join('\n')
}

/**
 * Reconcile the sentinel-delimited agent-guide block in an instructions file
 * against the freshly-rendered `block`. Pure — returns the action to report and
 * the next file contents, so `runInit` only has to write when `next` changed.
 *
 * - No block present → append it (`created`).
 * - Block present and byte-identical → `skipped`.
 * - Block present but drifted → replace just that block in place (`updated`),
 *   so a re-init always converges the pointer to the bundled content.
 */
export function reconcilePointer(
  current: string,
  block: string,
): { action: Action; detail: string; next: string } {
  if (current.includes(SENTINEL_START) && current.includes(SENTINEL_END)) {
    const blockRe = new RegExp(`${SENTINEL_START}[\\s\\S]*?${SENTINEL_END}`)
    if (current.match(blockRe)?.[0] === block) {
      return {
        action: 'skipped',
        detail: 'pointer already up to date',
        next: current,
      }
    }
    // Replace via a function so a `$` in the block is never read as a
    // replacement pattern; the regex is non-global → only the first block.
    return {
      action: 'updated',
      detail: 'refreshed agent-guide pointer',
      next: current.replace(blockRe, () => block),
    }
  }
  let sep = ''
  if (current.length) sep = current.endsWith('\n') ? '\n' : '\n\n'
  return {
    action: 'created',
    detail: 'added agent-guide pointer',
    next: `${current}${sep}${block}\n`,
  }
}

/** Are two directories' files byte-identical (used to decide skip vs update)? */
async function dirsEqual(a: string, b: string): Promise<boolean> {
  if (!existsSync(b)) return false
  const list = async (d: string) =>
    (await readdir(d, { withFileTypes: true }))
      .filter((e) => e.isFile())
      .map((e) => e.name)
      .sort()
  const [fa, fb] = await Promise.all([list(a), list(b)])
  if (fa.join('|') !== fb.join('|')) return false
  for (const name of fa) {
    const [ta, tb] = await Promise.all([
      Bun.file(join(a, name)).text(),
      Bun.file(join(b, name)).text(),
    ])
    if (ta !== tb) return false
  }
  return true
}

async function copyDir(src: string, dest: string): Promise<void> {
  await mkdir(dest, { recursive: true })
  for (const e of await readdir(src, { withFileTypes: true })) {
    if (e.isFile())
      await Bun.write(join(dest, e.name), Bun.file(join(src, e.name)))
  }
}

export async function runInit(
  pkgDir: string,
  opts: RunOptions,
): Promise<RunResult> {
  const target = AGENT_TARGETS[opts.agent] as AgentTarget
  const repoRoot = findRepoRoot(pkgDir)
  const items: PlanItem[] = []

  // 1. Launch config — merge, never clobber other entries.
  const launchPath = join(repoRoot, target.launchConfigPath)
  const existing = await readJson(launchPath)
  const config = existing ?? { version: '0.0.1', configurations: [] }
  const configs =
    (config.configurations as Record<string, unknown>[] | undefined) ?? []
  const entry = launchEntry(repoRoot, pkgDir)
  const idx = configs.findIndex((c) => c.name === LAUNCH_NAME)
  if (idx === -1) {
    configs.push(entry)
    items.push({
      artifact: target.launchConfigPath,
      action: 'created',
      detail: `added "${LAUNCH_NAME}" entry`,
    })
  } else if (JSON.stringify(configs[idx]) !== JSON.stringify(entry)) {
    configs[idx] = entry
    items.push({
      artifact: target.launchConfigPath,
      action: 'updated',
      detail: `refreshed "${LAUNCH_NAME}" entry`,
    })
  } else {
    items.push({
      artifact: target.launchConfigPath,
      action: 'skipped',
      detail: 'entry already present',
    })
  }
  config.configurations = configs
  if (!opts.dryRun && items[items.length - 1].action !== 'skipped') {
    await mkdir(dirname(launchPath), { recursive: true })
    await Bun.write(launchPath, `${JSON.stringify(config, null, 2)}\n`)
  }

  // 2. Skills — copy each bundled skill, skip identical, update changed.
  for (const id of await bundledSkillIds()) {
    const src = join(SKILLS_SRC, id)
    const dest = join(repoRoot, target.skillsDir, id)
    const rel = join(target.skillsDir, id)
    if (await dirsEqual(src, dest)) {
      items.push({ artifact: rel, action: 'skipped', detail: 'identical' })
      continue
    }
    const action: Action = existsSync(dest) ? 'updated' : 'created'
    items.push({ artifact: rel, action })
    if (!opts.dryRun) await copyDir(src, dest)
  }

  // 3. Instructions pointer — sentinel-marked, idempotent, and self-refreshing.
  // reconcilePointer converges an existing block to the bundled content (like
  // the skills above): byte-identical → skipped; drifted → replaced in place.
  const instrPath = resolveInstructionsFile(repoRoot, target)
  const instrRel = relative(repoRoot, instrPath)
  const current = (await Bun.file(instrPath).exists())
    ? await Bun.file(instrPath).text()
    : ''
  const { action, detail, next } = reconcilePointer(
    current,
    guideBlock(repoRoot),
  )
  items.push({ artifact: instrRel, action, detail })
  if (!opts.dryRun && next !== current) await Bun.write(instrPath, next)

  // 4. Optional visual-regression toolchain (opt-in).
  if (opts.withVisual) {
    items.push({
      artifact: 'visual-regression toolchain',
      action: 'created',
      detail: 'Playwright Chromium + pixelmatch/pngjs',
    })
    if (!opts.dryRun) await setupVisualToolchain(repoRoot)
  } else {
    items.push({
      artifact: 'visual-regression toolchain',
      action: 'skipped',
      detail: 'run `init --with-visual` to set up',
    })
  }

  return {
    command: 'init',
    agent: opts.agent,
    dryRun: opts.dryRun,
    json: opts.json,
    items,
  }
}

export async function runUninstall(
  pkgDir: string,
  opts: RunOptions,
): Promise<RunResult> {
  const target = AGENT_TARGETS[opts.agent] as AgentTarget
  const repoRoot = findRepoRoot(pkgDir)
  const items: PlanItem[] = []

  // 1. Launch config — drop only our entry; keep the file and other entries.
  const launchPath = join(repoRoot, target.launchConfigPath)
  const config = await readJson(launchPath)
  if (config) {
    const configs =
      (config.configurations as Record<string, unknown>[] | undefined) ?? []
    const idx = configs.findIndex((c) => c.name === LAUNCH_NAME)
    if (idx === -1) {
      items.push({
        artifact: target.launchConfigPath,
        action: 'skipped',
        detail: 'no entry to remove',
      })
    } else {
      configs.splice(idx, 1)
      config.configurations = configs
      items.push({
        artifact: target.launchConfigPath,
        action: 'removed',
        detail: `removed "${LAUNCH_NAME}" entry`,
      })
      if (!opts.dryRun)
        await Bun.write(launchPath, `${JSON.stringify(config, null, 2)}\n`)
    }
  } else {
    items.push({
      artifact: target.launchConfigPath,
      action: 'skipped',
      detail: 'no launch config',
    })
  }

  // 2. Skills — remove only directories matching bundled skill ids.
  for (const id of await bundledSkillIds()) {
    const dest = join(repoRoot, target.skillsDir, id)
    const rel = join(target.skillsDir, id)
    if (existsSync(dest)) {
      items.push({ artifact: rel, action: 'removed' })
      if (!opts.dryRun) await rm(dest, { recursive: true, force: true })
    } else {
      items.push({ artifact: rel, action: 'skipped', detail: 'not installed' })
    }
  }

  // 3. Instructions pointer — strip only the sentinel-delimited block.
  const instrPath = resolveInstructionsFile(repoRoot, target)
  const instrRel = relative(repoRoot, instrPath)
  const current = (await Bun.file(instrPath).exists())
    ? await Bun.file(instrPath).text()
    : ''
  if (current.includes(SENTINEL_START) && current.includes(SENTINEL_END)) {
    const re = new RegExp(
      `\\n*${SENTINEL_START}[\\s\\S]*?${SENTINEL_END}\\n*`,
      'g',
    )
    const stripped = `${current
      .replace(re, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd()}\n`
    items.push({
      artifact: instrRel,
      action: 'removed',
      detail: 'removed agent-guide pointer',
    })
    if (!opts.dryRun) await Bun.write(instrPath, stripped)
  } else {
    items.push({
      artifact: instrRel,
      action: 'skipped',
      detail: 'no pointer present',
    })
  }

  return {
    command: 'uninstall',
    agent: opts.agent,
    dryRun: opts.dryRun,
    json: opts.json,
    items,
  }
}

const MARK: Record<Action, string> = {
  created: '+',
  updated: '~',
  removed: '-',
  skipped: '·',
}

/** Print the result as a human report, or JSON when requested. */
export function report(result: RunResult): void {
  if (result.json) {
    console.log(JSON.stringify(result, null, 2))
    return
  }
  const verb = result.command === 'init' ? 'init' : 'uninstall'
  const dry = result.dryRun ? ' (dry run)' : ''
  console.log(`\n  display-case ${verb} → ${result.agent}${dry}`)
  for (const it of result.items) {
    console.log(
      `    ${MARK[it.action]} ${it.action.padEnd(7)} ${it.artifact}${it.detail ? `  (${it.detail})` : ''}`,
    )
  }
  const changed = result.items.filter((i) => i.action !== 'skipped').length
  console.log(
    `  ${changed} change(s)${result.dryRun ? ' planned' : ''}, ${result.items.length - changed} skipped\n`,
  )
}
